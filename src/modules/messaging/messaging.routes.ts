import type { FastifyInstance } from 'fastify';
import { FcmProvider } from '@/modules/sms/providers/fcm.provider.js';
import { SmsService } from '@/modules/sms/sms.service.js';
import { DeviceRouter } from '@/modules/sms/device-router.js';
import { buildSmsQueue } from '@/queue/queues.js';
import { TokensService } from '@/modules/tokens/tokens.service.js';
import { MessagingService } from './messaging.service.js';
import { MessagingController } from './messaging.controller.js';
import {
  SendSmsBody,
  SmsIdParam,
  type SendSmsBodyT,
  type SmsIdParamT,
} from './messaging.schemas.js';

export async function registerMessagingRoutes(app: FastifyInstance): Promise<void> {
  const env = app.env;
  const provider = new FcmProvider(app.fcm, app.log);
  const router = DeviceRouter.create(app.prisma, env, app.log);
  const smsService = new SmsService(app.prisma, env, app.log, provider, router, app.redis);
  const tokens = new TokensService(app.prisma, app.log);
  const { queue: smsQueue, client: smsQueueClient } = buildSmsQueue(env);

  app.addHook('onClose', async () => {
    await smsQueue.close();
    await smsQueueClient.quit().catch(() => undefined);
  });

  const service = new MessagingService(
    app.prisma,
    env,
    app.log,
    smsService,
    router,
    smsQueue,
    tokens,
  );
  const controller = new MessagingController(service);

  app.post<{ Body: SendSmsBodyT }>(
    '/v1/sms/send',
    {
      preHandler: app.requireAdmin,
      schema: {
        body: SendSmsBody,
        tags: ['messaging'],
        security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
      },
    },
    controller.send,
  );

  app.get<{ Params: SmsIdParamT }>(
    '/v1/sms/:id',
    {
      preHandler: app.requireAdmin,
      schema: {
        params: SmsIdParam,
        tags: ['messaging'],
        security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
      },
    },
    controller.status,
  );
}
