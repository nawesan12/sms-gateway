import type { Queue } from 'bullmq';
import type { PrismaClient } from '@prisma/client';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';
import { validateAndNormalizePhone } from '@/lib/phone.js';
import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';
import { SmsService } from '@/modules/sms/sms.service.js';
import type { DeviceRouter } from '@/modules/sms/device-router.js';
import type { SmsSendJob } from '@/queue/jobs/job.types.js';

export interface SendOneInput {
  rawPhone: string;
  message: string;
  contactId?: string | null;
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
    private readonly smsQueue: Queue<SmsSendJob>,
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

    await this.smsQueue.add(
      'sms.send',
      {
        smsMessageId: smsId,
        recipientE164: validation.e164,
        message,
        correlationId: input.correlationId,
      },
      {
        attempts: this.env.WORKER_MAX_RETRIES + 1,
        backoff: { type: 'exponential', delay: this.env.WORKER_BACKOFF_MS },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    );

    this.logger.info(
      { smsMessageId: smsId, deviceId: device.id, contactId: input.contactId ?? null },
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
