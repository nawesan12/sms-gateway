import type { FastifyInstance } from 'fastify';
import { FcmProvider } from '@/modules/sms/providers/fcm.provider.js';
import { SmsService } from '@/modules/sms/sms.service.js';
import { DeviceRouter } from '@/modules/sms/device-router.js';
import { buildSmsQueue } from '@/queue/queues.js';
import { RateLimitService } from '@/modules/ratelimit/rate-limit.service.js';
import { AuthService } from './auth.service.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthController } from './auth.controller.js';
import {
  CreateAccessLinkBody,
  ErrorResponse,
  SendCodeBody,
  SendCodeResponse,
  VerifyCodeBody,
  VerifyCodeResponse,
  type CreateAccessLinkBodyT,
  type SendCodeBodyT,
  type VerifyCodeBodyT,
} from './auth.schemas.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const env = app.env;

  const provider = new FcmProvider(app.fcm, app.log);
  const router = DeviceRouter.create(app.prisma, env, app.log);

  const smsQueue = buildSmsQueue(app.prisma);
  const smsService = new SmsService(app.prisma, env, app.log, provider, router);
  const rateLimit = new RateLimitService(env);

  const service = new AuthService({
    prisma: app.prisma,
    env,
    logger: app.log,
    smsQueue,
    smsService,
    deviceRouter: router,
    rateLimit,
    signAccessToken: (payload) =>
      app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_TTL_SEC }) as unknown as Promise<string>,
    signRefreshToken: (payload) =>
      app.jwt.sign(payload, { expiresIn: env.JWT_REFRESH_TTL_SEC }) as unknown as Promise<string>,
  });
  const accessTokens = new AccessTokenService(app.prisma, env, app.log);
  const controller = new AuthController(service, accessTokens);

  app.post<{ Body: SendCodeBodyT }>(
    '/v1/auth/send-code',
    {
      schema: {
        body: SendCodeBody,
        response: { 200: SendCodeResponse, 400: ErrorResponse, 429: ErrorResponse },
        tags: ['auth'],
      },
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_IP_MAX,
          timeWindow: env.RATE_LIMIT_IP_WINDOW_SEC * 1000,
        },
      },
    },
    controller.sendCode,
  );

  app.post<{ Body: VerifyCodeBodyT }>(
    '/v1/auth/verify-code',
    {
      schema: {
        body: VerifyCodeBody,
        response: { 200: VerifyCodeResponse, 400: ErrorResponse, 429: ErrorResponse },
        tags: ['auth'],
      },
    },
    controller.verifyCode,
  );

  app.post<{ Body: CreateAccessLinkBodyT }>(
    '/v1/admin/auth/access-link',
    {
      preHandler: app.requireOperator,
      schema: {
        body: CreateAccessLinkBody,
        tags: ['operator', 'auth'],
        security: [{ bootstrapToken: [] }],
      },
    },
    controller.createAccessLink,
  );
}
