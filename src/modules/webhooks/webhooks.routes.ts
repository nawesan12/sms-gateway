import type { FastifyInstance } from 'fastify';
import { deriveSecret } from '@/lib/derive-secret.js';
import { WebhooksService } from './webhooks.service.js';
import { WebhooksController } from './webhooks.controller.js';

export const UPSTREAM_WEBHOOK_SECRET_LABEL = 'upstream-webhook-v1';

export async function registerWebhooksRoutes(app: FastifyInstance): Promise<void> {
  const secret = deriveSecret(app.env.MASTER_ENCRYPTION_KEY_B64, UPSTREAM_WEBHOOK_SECRET_LABEL);
  const service = new WebhooksService(app.prisma, app.redis, app.log);
  const controller = new WebhooksController(service, secret);

  app.post(
    '/v1/webhooks/sms-status',
    {
      // Sin auth bearer: la autenticación es por HMAC del header X-Signature.
      // Sin rate limit: el upstream reintenta con backoff y bloquearlo
      // perdería eventos legítimos.
      config: { rateLimit: false },
      schema: { tags: ['webhooks'] },
    },
    controller.smsStatus,
  );
}
