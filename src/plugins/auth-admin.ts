import fp from 'fastify-plugin';
import type { FastifyRequest } from 'fastify';
import { AppError } from './error-handler.js';
import { AUDIT_EVENTS, ERROR_CODES } from '@/config/constants.js';
import { hashAccessToken } from '@/modules/auth/access-token.service.js';
import { AuditService } from '@/modules/audit/audit.service.js';

const JWT_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export default fp(
  async (app) => {
    app.decorate('requireAdmin', async (req: FastifyRequest) => {
      // 1. Bootstrap header (operador con acceso super-admin via env var).
      const bootstrap = req.headers['x-bootstrap-token'];
      if (typeof bootstrap === 'string' && bootstrap === app.env.ADMIN_BOOTSTRAP_TOKEN) {
        req.authUser = { id: 'bootstrap', phoneE164: 'bootstrap', role: 'ADMIN' };
        return;
      }

      // 2. Authorization: Bearer <token> — puede ser JWT o access token estático.
      const authHeader = req.headers.authorization;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length).trim();

        // Heurística simple: JWT tiene 3 segmentos separados por punto.
        // Access token estático es base64url ~43 chars (sin puntos).
        if (token && !JWT_REGEX.test(token)) {
          const tokenHash = hashAccessToken(token);
          const user = await app.prisma.user.findUnique({ where: { accessTokenHash: tokenHash } });
          if (user && !user.isBlocked && user.role === 'ADMIN') {
            req.authUser = { id: user.id, phoneE164: user.phoneE164, role: 'ADMIN' };
            // Audit fire-and-forget (no awaiteamos para no penalizar latencia)
            const audit = new AuditService(app.prisma, app.log);
            void audit.record({
              eventType: AUDIT_EVENTS.ACCESS_TOKEN_USED,
              actorType: 'user',
              actorId: user.id,
              targetType: 'user',
              targetId: user.id,
              ipAddress: req.ip ?? null,
              correlationId: req.correlationId,
            });
            return;
          }
        }
      }

      // 3. Fallback: JWT estándar via @fastify/jwt.
      await app.authenticate(req);
      if (!req.authUser || req.authUser.role !== 'ADMIN') {
        throw new AppError(ERROR_CODES.FORBIDDEN, 'Admin role required', 403);
      }
    });
  },
  { name: 'auth-admin', dependencies: ['auth-jwt'] },
);

declare module 'fastify' {
  interface FastifyInstance {
    requireAdmin: (req: FastifyRequest) => Promise<void>;
  }
}
