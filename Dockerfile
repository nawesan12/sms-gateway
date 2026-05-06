# syntax=docker/dockerfile:1.7
# =============================================================
# SMS Gateway · Production Dockerfile (multi-stage)
# Build incluye:
#   1) frontend Vite (web/)  → web/dist/
#   2) backend Fastify (src/) → dist/
# El runtime sirve la UI desde web/dist y la API en :3000.
# =============================================================

# ---------- 1) Web (Vite) ----------
FROM node:22-alpine AS web-builder
WORKDIR /app/web
# Sólo package.json — sin lockfile, npm resuelve fresh dentro del container
# y evita el bug de rollup con optional deps platform-specific (linux-musl-arm/x64).
COPY web/package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund --include=dev
COPY web/ .
RUN npm run build

# ---------- 2) Backend (TypeScript → JS) ----------
FROM node:22-alpine AS api-builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund --include=dev

COPY tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

# ---------- 3) Runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl tini wget && \
    addgroup -S app && adduser -S app -G app

COPY --from=api-builder --chown=app:app /app/node_modules ./node_modules
COPY --from=api-builder --chown=app:app /app/dist ./dist
COPY --from=api-builder --chown=app:app /app/prisma ./prisma
COPY --from=api-builder --chown=app:app /app/package.json ./package.json
COPY --from=web-builder --chown=app:app /app/web/dist ./web/dist

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
