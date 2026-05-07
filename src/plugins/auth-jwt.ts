import fp from 'fastify-plugin';
import type { FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import { AppError } from './error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';

export default fp(
  async (app) => {
    const env = app.env;
    const privateKey = Buffer.from(env.JWT_PRIVATE_KEY_B64, 'base64').toString('utf8');
    const publicKey = Buffer.from(env.JWT_PUBLIC_KEY_B64, 'base64').toString('utf8');

    await app.register(jwt, {
      secret: { private: privateKey, public: publicKey },
      sign: {
        algorithm: 'RS256',
        iss: env.JWT_ISSUER,
        aud: env.JWT_AUDIENCE,
      },
      verify: { algorithms: ['RS256'], allowedIss: env.JWT_ISSUER, allowedAud: env.JWT_AUDIENCE },
    });

    app.decorate('authenticate', async (req: FastifyRequest) => {
      try {
        const decoded = await req.jwtVerify<{
          sub: string;
          phone: string;
          role: 'USER' | 'ADMIN';
        }>();
        req.authUser = { id: decoded.sub, phoneE164: decoded.phone, role: decoded.role };
      } catch {
        throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Invalid or missing token', 401);
      }
    });
  },
  { name: 'auth-jwt', dependencies: ['env', 'error-handler'] },
);

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest) => Promise<void>;
  }
}
