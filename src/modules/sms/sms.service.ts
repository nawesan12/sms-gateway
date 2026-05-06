import { SmsStatus, type PrismaClient, type Device } from '@prisma/client';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';
import { DeviceCrypto } from '@/modules/devices/crypto.js';
import { metrics } from '@/plugins/metrics.js';
import type { SmsProvider } from './providers/sms-provider.interface.js';
import type { SendResult } from './providers/textbee.types.js';
import { SmsRepository } from './sms.repository.js';
import { DeviceRouter } from './device-router.js';

export interface DispatchInput {
  smsMessageId: string;
  recipientE164: string;
  message: string;
  deviceIdHint?: string;
  excludeDeviceIds?: string[];
}

export interface DispatchOutput {
  device: Device;
  result: SendResult;
}

export class SmsService {
  private readonly repo: SmsRepository;

  constructor(
    private readonly prisma: PrismaClient,
    _env: AppEnv,
    private readonly logger: AppLogger,
    private readonly provider: SmsProvider,
    private readonly router: DeviceRouter,
    private readonly crypto: DeviceCrypto,
  ) {
    this.repo = new SmsRepository(prisma);
  }

  async createPending(args: {
    deviceId: string;
    recipientE164: string;
    otpRequestId?: string;
  }): Promise<string> {
    const sms = await this.repo.create({
      deviceId: args.deviceId,
      recipientE164: args.recipientE164,
      status: SmsStatus.PENDING,
      otpRequestId: args.otpRequestId ?? null,
    });
    return sms.id;
  }

  async dispatch(input: DispatchInput): Promise<DispatchOutput> {
    const exclude = input.excludeDeviceIds ?? [];
    let device: Device;
    if (input.deviceIdHint) {
      const candidate = await this.prisma.device.findUnique({ where: { id: input.deviceIdHint } });
      if (!candidate || exclude.includes(candidate.id) || !this.router.circuitBreaker.isAvailable(candidate)) {
        device = await this.router.select(exclude);
      } else {
        device = candidate;
      }
    } else {
      device = await this.router.select(exclude);
    }

    await this.prisma.smsMessage.update({
      where: { id: input.smsMessageId },
      data: { deviceId: device.id },
    });

    const apiKey = this.crypto.decrypt(device.apiKeyEncrypted);
    const start = Date.now();
    const result = await this.provider.sendSMS({
      textbeeDeviceId: device.textbeeDeviceId,
      apiKey,
      recipients: [input.recipientE164],
      message: input.message,
    });
    const latencySec = (Date.now() - start) / 1000;
    metrics.smsProviderLatency
      .labels({ device: device.name, result: result.ok ? 'ok' : 'error' })
      .observe(latencySec);

    if (result.ok) {
      await this.repo.markSent(input.smsMessageId, result.providerMessageId);
      await this.router.circuitBreaker.recordSuccess(device.id);
      metrics.smsSent.labels({ device: device.name, result: 'ok' }).inc();
      this.logger.info(
        { deviceId: device.id, smsId: input.smsMessageId, providerMessageId: result.providerMessageId },
        'sms sent',
      );
    } else {
      await this.router.circuitBreaker.recordFailure(device.id);
      metrics.smsErrors
        .labels({ device: device.name, code: result.errorCode ?? 'UNKNOWN' })
        .inc();
      this.logger.warn(
        { deviceId: device.id, smsId: input.smsMessageId, errorCode: result.errorCode },
        'sms send failed',
      );
    }

    return { device, result };
  }

  async finalizeFailure(smsMessageId: string, code: string, message: string): Promise<void> {
    await this.repo.markFailed(smsMessageId, code, message);
    metrics.smsSent.labels({ device: 'n/a', result: 'failed' }).inc();
  }

  async bumpRetry(smsMessageId: string): Promise<void> {
    await this.repo.bumpRetry(smsMessageId);
  }
}
