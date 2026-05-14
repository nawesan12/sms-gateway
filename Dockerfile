# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22-bookworm-slim

# =============================================================================
# Stage 1 — builder: deps completas, prisma generate, tsc build, prune a prod
# =============================================================================
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

# OpenSSL para Prisma engine + build tools para argon2 (descartados en runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
        openssl \
        ca-certificates \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*

# Instalación reproducible con lockfile (incluye dev deps para tsc)
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Cliente de Prisma generado contra el schema
RUN npx prisma generate

# Build del backend (tsc + tsc-alias → dist/)
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Quedarse solo con prod deps para copiar al runtime.
# `npm prune` mantiene los binarios nativos (argon2) y el cliente prisma generado.
RUN npm prune --omit=dev


# =============================================================================
# Stage 2 — runtime: imagen mínima sin build tools, usuario no-root, tini
# =============================================================================
FROM node:${NODE_VERSION} AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# OpenSSL para Prisma + tini para forwarding correcto de SIGTERM
RUN apt-get update && apt-get install -y --no-install-recommends \
        openssl \
        ca-certificates \
        tini \
    && rm -rf /var/lib/apt/lists/* \
    && chown node:node /app

USER node

# Artefactos del builder
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package.json package-lock.json ./

# Frontend pre-buildeado (committeado al repo)
COPY --chown=node:node web/dist ./web/dist

EXPOSE 3000

# Healthcheck nativo en Node — usa fetch global (Node 22) para no depender de curl
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini como PID 1 para reapear zombies y propagar señales al proceso Node.
# El `syncDatabaseSchema()` del index.ts corre `prisma db push` al boot,
# así que no hace falta un step de migraciones aparte.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
