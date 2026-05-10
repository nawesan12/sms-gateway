import { SmsStatus } from '@prisma/client';
import { metrics } from '../../plugins/metrics.js';
import { SmsRepository } from './sms.repository.js';
export class SmsService {
    prisma;
    logger;
    provider;
    router;
    crypto;
    repo;
    constructor(prisma, _env, logger, provider, router, crypto) {
        this.prisma = prisma;
        this.logger = logger;
        this.provider = provider;
        this.router = router;
        this.crypto = crypto;
        this.repo = new SmsRepository(prisma);
    }
    async createPending(args) {
        const sms = await this.repo.create({
            deviceId: args.deviceId,
            recipientE164: args.recipientE164,
            status: SmsStatus.PENDING,
            otpRequestId: args.otpRequestId ?? null,
        });
        return sms.id;
    }
    async dispatch(input) {
        const exclude = input.excludeDeviceIds ?? [];
        let device;
        if (input.deviceIdHint) {
            const candidate = await this.prisma.device.findUnique({ where: { id: input.deviceIdHint } });
            if (!candidate ||
                exclude.includes(candidate.id) ||
                !this.router.circuitBreaker.isAvailable(candidate)) {
                device = await this.router.select(exclude);
            }
            else {
                device = candidate;
            }
        }
        else {
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
            this.logger.info({
                deviceId: device.id,
                smsId: input.smsMessageId,
                providerMessageId: result.providerMessageId,
            }, 'sms sent');
        }
        else {
            await this.router.circuitBreaker.recordFailure(device.id);
            metrics.smsErrors.labels({ device: device.name, code: result.errorCode ?? 'UNKNOWN' }).inc();
            this.logger.warn({ deviceId: device.id, smsId: input.smsMessageId, errorCode: result.errorCode }, 'sms send failed');
        }
        return { device, result };
    }
    async finalizeFailure(smsMessageId, code, message) {
        await this.repo.markFailed(smsMessageId, code, message);
        metrics.smsSent.labels({ device: 'n/a', result: 'failed' }).inc();
    }
    async bumpRetry(smsMessageId) {
        await this.repo.bumpRetry(smsMessageId);
    }
}
