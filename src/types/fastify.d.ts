import 'fastify';
import type { FastifyRequest } from 'fastify';
import type { PrismaClient, User } from '@prisma/client';
import type { Messaging } from 'firebase-admin/messaging';
import type { AppEnv } from '@/config/env.js';
import type { Logger } from 'pino';

declare module 'fastify' {
  interface FastifyInstance {
    env: AppEnv;
    prisma: PrismaClient;
    fcm: Messaging | null;
    appLogger: Logger;
  }

  interface FastifyRequest {
    correlationId: string;
    authUser?: { id: string; phoneE164: string; role: 'USER' | 'ADMIN' } | null;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; phone: string; role: 'USER' | 'ADMIN' };
    user: { sub: string; phone: string; role: 'USER' | 'ADMIN' };
  }
}

export type AuthUser = NonNullable<FastifyRequest['authUser']>;
export type _PrismaUser = User;
