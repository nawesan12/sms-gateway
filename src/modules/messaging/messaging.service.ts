import type { PrismaClient } from '@prisma/client';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';
import { validateAndNormalizePhone } from '@/lib/phone.js';
import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';
import type { SmsService } from '@/modules/sms/sms.service.js';
import type { DeviceRouter } from '@/modules/sms/device-router.js';
import type { PgQueue } from '@/queue/pg-queue.js';
import type { SmsSendJob } from '@/queue/jobs/job.types.js';
import type { TokensService } from '@/modules/tokens/tokens.service.js';

export interface SendOneInput {
  rawPhone: string;
  message: string;
  contactId?: string | null;
  ownerUserId: string;
  correlationId: string;
}

export interface SendOneOutput {
  smsMessageId: string;
  recipientE164: string;
  status: 'PENDING';
}

export class MessagingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly env: AppEnv,
    private readonly logger: AppLogger,
    private readonly smsService: SmsService,
    private readonly router: DeviceRouter,
    private readonly smsQueue: PgQueue<SmsSendJob>,
    private readonly tokens: TokensService,
  ) {}

  async sendOne(input: SendOneInput): Promise<SendOneOutput> {
    const validation = validateAndNormalizePhone(input.rawPhone, this.env.DEFAULT_PHONE_REGION);
    if (!validation.valid) {
      throw new AppError(ERROR_CODES.INVALID_PHONE, 'Invalid phone number', 400);
    }
    const message = (input.message ?? '').trim();
    if (message.length === 0) {
      throw new AppError(ERROR_CODES.VALIDATION, 'Message cannot be empty', 400);
    }
    if (message.length > 1600) {
      throw new AppError(ERROR_CODES.VALIDATION, 'Message too long (max 1600 chars)', 400);
    }

    if (input.contactId) {
      const contact = await this.prisma.contact.findUnique({ where: { id: input.contactId } });
      if (!contact) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'Contact not found', 404);
      }
    }

    const device = await this.router.select();
    const smsId = await this.smsService.createPending({
      deviceId: device.id,
      recipientE164: validation.e164,
    });

    const reservation = await this.tokens.reserve({
      userId: input.ownerUserId,
      amount: 1,
      smsMessageId: smsId,
      reason: 'sms.individual',
      correlationId: input.correlationId,
    });
    if (!reservation.ok) {
      await this.smsService.finalizeFailure(
        smsId,
        ERROR_CODES.INSUFFICIENT_TOKENS,
        'no token balance',
      );
      throw new AppError(ERROR_CODES.INSUFFICIENT_TOKENS, 'Insufficient token balance', 402, {
        balance: reservation.balance,
        required: reservation.required,
      });
    }

    await this.prisma.smsMessage.update({
      where: { id: smsId },
      data: { tokenTransactionId: reservation.transactionId },
    });

    try {
      await this.smsQueue.add(
        {
          smsMessageId: smsId,
          tokenTransactionId: reservation.transactionId,
          recipientE164: validation.e164,
          message,
          correlationId: input.correlationId,
        },
        { maxAttempts: this.env.WORKER_MAX_RETRIES + 1 },
      );
    } catch (err) {
      await this.tokens.refund(reservation.transactionId, 'enqueue_failed');
      await this.smsService.finalizeFailure(smsId, 'ENQUEUE_FAILED', (err as Error).message);
      throw err;
    }

    this.logger.info(
      {
        smsMessageId: smsId,
        deviceId: device.id,
        contactId: input.contactId ?? null,
        transactionId: reservation.transactionId,
      },
      'sms enqueued',
    );

    return { smsMessageId: smsId, recipientE164: validation.e164, status: 'PENDING' };
  }

  async getSmsStatus(id: string) {
    const sms = await this.prisma.smsMessage.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        recipientE164: true,
        textbeeMessageId: true,
        errorCode: true,
        errorMessage: true,
        sentAt: true,
        deliveredAt: true,
        failedAt: true,
        retryCount: true,
        createdAt: true,
      },
    });
    if (!sms) throw new AppError(ERROR_CODES.NOT_FOUND, 'SMS not found', 404);
    return sms;
  }
}
