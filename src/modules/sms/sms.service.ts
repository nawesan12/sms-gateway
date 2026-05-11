import { SmsStatus, type PrismaClient, type Device } from '@prisma/client';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';
import { metrics } from '@/plugins/metrics.js';
import type { SmsProvider } from './providers/sms-provider.interface.js';
import type { SendResult } from './providers/provider.types.js';
import { SmsRepository } from './sms.repository.js';
import type { DeviceRouter } from './device-router.js';

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

const COOLDOWN_LOOKUP_MAX_ATTEMPTS = 10;

export class SmsService {
  private readonly repo: SmsRepository;

  constructor(
    private readonly prisma: PrismaClient,
    _env: AppEnv,
    private readonly logger: AppLogger,
    private readonly provider: SmsProvider,
    private readonly router: DeviceRouter,
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

  // Atomic cooldown lock en Postgres. Setea Device.cooldownUntil = now + ms
  // solo si está vencido (o null). Reemplazo del SET NX PX que antes hacíamos
  // en Redis. Atomicidad garantizada por updateMany() con WHERE compuesto.
  private async tryAcquireCooldown(deviceId: string, ms: number): Promise<boolean> {
    const now = new Date();
    const until = new Date(now.getTime() + ms);
    const updated = await this.prisma.device.updateMany({
      where: {
        id: deviceId,
        OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: now } }],
      },
      data: { cooldownUntil: until },
    });
    return updated.count === 1;
  }

  async dispatch(input: DispatchInput): Promise<DispatchOutput> {
    const exclude = new Set(input.excludeDeviceIds ?? []);
    let device: Device | null = null;

    for (let attempt = 0; attempt < COOLDOWN_LOOKUP_MAX_ATTEMPTS; attempt++) {
      const excludeArr = Array.from(exclude);
      let candidate: Device;

      if (attempt === 0 && input.deviceIdHint) {
        const hinted = await this.prisma.device.findUnique({ where: { id: input.deviceIdHint } });
        if (hinted && !exclude.has(hinted.id) && this.router.circuitBreaker.isAvailable(hinted)) {
          candidate = hinted;
        } else {
          candidate = await this.router.select(excludeArr);
        }
      } else {
        candidate = await this.router.select(excludeArr);
      }

      // Cooldown: si el device exige minDelay entre envíos, intentar tomar
      // el lock atómico en Postgres (UPDATE … WHERE cooldownUntil expirado).
      if (candidate.minDelayBetweenMs > 0) {
        const acquired = await this.tryAcquireCooldown(candidate.id, candidate.minDelayBetweenMs);
        if (!acquired) {
          this.logger.debug(
            { deviceId: candidate.id, minDelayBetweenMs: candidate.minDelayBetweenMs },
            'device in cooldown, trying next',
          );
          exclude.add(candidate.id);
          continue;
        }
      }

      device = candidate;
      break;
    }

    if (!device) {
      throw new Error('DEVICE_COOLDOWN: all eligible devices are in cooldown');
    }

    await this.prisma.smsMessage.update({
      where: { id: input.smsMessageId },
      data: { deviceId: device.id },
    });

    const start = Date.now();
    const result = await this.provider.sendSMS({
      device,
      smsMessageId: input.smsMessageId,
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
        {
          deviceId: device.id,
          smsId: input.smsMessageId,
          providerMessageId: result.providerMessageId,
        },
        'sms sent',
      );
    } else {
      await this.router.circuitBreaker.recordFailure(device.id);
      metrics.smsErrors.labels({ device: device.name, code: result.errorCode ?? 'UNKNOWN' }).inc();
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
