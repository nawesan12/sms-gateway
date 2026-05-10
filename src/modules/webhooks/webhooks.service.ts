import { SmsStatus, type PrismaClient } from '@prisma/client';
import type IORedis from 'ioredis';
import type { AppLogger } from '@/lib/logger-types.js';
import type { WebhookSmsStatusBodyT } from './webhooks.schemas.js';

const IDEMPOTENCY_TTL_SEC = 7 * 24 * 3600;

export class WebhooksService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: IORedis,
    private readonly logger: AppLogger,
  ) {}

  // Devuelve true si el evento es nuevo y debe procesarse, false si ya lo vimos.
  private async claimIdempotency(key: string): Promise<boolean> {
    const res = await this.redis.set(
      `webhook:idem:${key}`,
      '1',
      'EX',
      IDEMPOTENCY_TTL_SEC,
      'NX',
    );
    return res !== null;
  }

  async handleSmsStatus(payload: WebhookSmsStatusBodyT): Promise<void> {
    const fresh = await this.claimIdempotency(payload.idempotencyKey);
    if (!fresh) {
      this.logger.debug({ idempotencyKey: payload.idempotencyKey }, 'webhook duplicate, skip');
      return;
    }

    const upstreamSmsId = payload.smsId;
    if (!upstreamSmsId) {
      this.logger.warn({ payload }, 'webhook without smsId, cannot match');
      return;
    }

    const sms = await this.prisma.smsMessage.findFirst({
      where: { textbeeMessageId: upstreamSmsId },
    });
    if (!sms) {
      this.logger.warn(
        { upstreamSmsId, event: payload.webhookEvent },
        'webhook for unknown sms (not in our db)',
      );
      return;
    }

    switch (payload.webhookEvent) {
      case 'MESSAGE_DELIVERED': {
        const deliveredAt = payload.deliveredAt ? new Date(payload.deliveredAt) : new Date();
        await this.prisma.smsMessage.update({
          where: { id: sms.id },
          data: { status: SmsStatus.DELIVERED, deliveredAt },
        });
        this.logger.info({ smsId: sms.id, deliveredAt }, 'sms delivered');
        return;
      }
      case 'MESSAGE_FAILED': {
        const failedAt = payload.failedAt ? new Date(payload.failedAt) : new Date();
        await this.prisma.smsMessage.update({
          where: { id: sms.id },
          data: {
            status: SmsStatus.FAILED,
            failedAt,
            errorCode: 'REMOTE_FAILURE',
            errorMessage: payload.errorMessage ?? payload.status ?? null,
          },
        });
        this.logger.info({ smsId: sms.id }, 'sms failed (remote)');
        return;
      }
      case 'MESSAGE_SENT': {
        // Ya lo seteamos optimistically al postear. Solo backfill sentAt si falta.
        if (!sms.sentAt && payload.sentAt) {
          await this.prisma.smsMessage.update({
            where: { id: sms.id },
            data: { sentAt: new Date(payload.sentAt) },
          });
        }
        return;
      }
      case 'MESSAGE_RECEIVED':
        // No usamos SMS entrantes en la plataforma.
        return;
    }
  }
}
