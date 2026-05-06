import fp from 'fastify-plugin';
import { AppError } from './error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';

export default fp(
  async (app) => {
    app.decorate('requireAdmin', async (req: import('fastify').FastifyRequest) => {
      // Allow bootstrap header during MVP / first admin creation flows.
      const bootstrap = req.headers['x-bootstrap-token'];
      if (typeof bootstrap === 'string' && bootstrap === app.env.ADMIN_BOOTSTRAP_TOKEN) {
        req.authUser = { id: 'bootstrap', phoneE164: 'bootstrap', role: 'ADMIN' };
        return;
      }
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
    requireAdmin: (req: import('fastify').FastifyRequest) => Promise<void>;
  }
}
