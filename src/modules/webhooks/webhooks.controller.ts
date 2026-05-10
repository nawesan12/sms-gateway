import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { WebhookSmsStatusBody, type WebhookSmsStatusBodyT } from './webhooks.schemas.js';
import type { WebhooksService } from './webhooks.service.js';

export class WebhooksController {
  constructor(
    private readonly service: WebhooksService,
    private readonly secret: string,
  ) {}

  smsStatus = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // El body viene como Buffer (raw) gracias al content-type parser dedicado en app.ts.
    const raw = req.body as Buffer;
    const signatureHeader = req.headers['x-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature || !raw || !Buffer.isBuffer(raw)) {
      reply.code(401).send({ success: false, error: 'missing signature or body' });
      return;
    }

    const expected = createHmac('sha256', this.secret).update(raw).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      reply.code(401).send({ success: false, error: 'invalid signature' });
      return;
    }

    let parsed: WebhookSmsStatusBodyT;
    try {
      parsed = JSON.parse(raw.toString('utf8')) as WebhookSmsStatusBodyT;
    } catch {
      reply.code(400).send({ success: false, error: 'invalid json' });
      return;
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.webhookEvent !== 'string' ||
      typeof parsed.idempotencyKey !== 'string'
    ) {
      reply.code(400).send({ success: false, error: 'missing required fields' });
      return;
    }

    // Validación adicional con typebox-equivalent rápida — no bloqueante;
    // si falta un campo opcional el service lo maneja. Schema reservado por
    // si querés enchufar @sinclair/typebox compile en el futuro.
    void WebhookSmsStatusBody;

    await this.service.handleSmsStatus(parsed);
    reply.code(200).send({ success: true });
  };
}
