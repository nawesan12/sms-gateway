import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { QUEUE_NAMES, AUDIT_EVENTS } from '../../config/constants.js';
import { TextBeeProvider } from '../../modules/sms/providers/textbee.provider.js';
import { SmsService } from '../../modules/sms/sms.service.js';
import { DeviceRouter } from '../../modules/sms/device-router.js';
import { DeviceCrypto } from '../../modules/devices/crypto.js';
import { AuditService } from '../../modules/audit/audit.service.js';
import { TokensService } from '../../modules/tokens/tokens.service.js';
import { metrics } from '../../plugins/metrics.js';
import { buildDlqQueue } from '../queues.js';
export function startSmsSendWorker(env, logger) {
    const prisma = new PrismaClient();
    const provider = new TextBeeProvider(env, logger);
    const crypto = new DeviceCrypto(env.MASTER_ENCRYPTION_KEY_B64);
    const router = DeviceRouter.create(prisma, env, logger);
    const sms = new SmsService(prisma, env, logger, provider, router, crypto);
    const audit = new AuditService(prisma, logger);
    const tokens = new TokensService(prisma, logger);
    const { queue: dlq, client: dlqClient } = buildDlqQueue(env);
    const connectionClient = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    const worker = new Worker(QUEUE_NAMES.SMS_SEND, async (job) => {
        const { smsMessageId, recipientE164, message, correlationId } = job.data;
        const exclude = job.data.excludeDeviceIds ?? [];
        const childLog = logger.child({ jobId: job.id, smsMessageId, correlationId });
        if (job.attemptsMade > 0) {
            await sms.bumpRetry(smsMessageId);
        }
        try {
            const { device, result } = await sms.dispatch({
                smsMessageId,
                recipientE164,
                message,
                excludeDeviceIds: exclude,
            });
            if (result.ok) {
                await audit.record({
                    eventType: AUDIT_EVENTS.SMS_SENT,
                    actorType: 'system',
                    targetType: 'sms_message',
                    targetId: smsMessageId,
                    metadata: {
                        deviceId: device.id,
                        providerMessageId: result.providerMessageId,
                        latencyMs: result.latencyMs,
                    },
                    correlationId,
                });
                if (job.data.tokenTransactionId) {
                    await tokens.commit(job.data.tokenTransactionId);
                }
                return { ok: true };
            }
            // Failed: mark this device as excluded and let BullMQ retry the job.
            const newExclude = [...exclude, device.id];
            await job.updateData({ ...job.data, excludeDeviceIds: newExclude });
            throw new Error(`provider error: ${result.errorCode ?? 'unknown'} ${result.errorMessage ?? ''}`);
        }
        catch (err) {
            childLog.warn({ err }, 'sms-send job error');
            throw err;
        }
    }, {
        connection: connectionClient,
        concurrency: env.WORKER_CONCURRENCY,
    });
    worker.on('completed', (job) => {
        logger.debug({ jobId: job.id }, 'sms-send completed');
    });
    worker.on('failed', async (job, err) => {
        if (!job)
            return;
        const attemptsMade = job.attemptsMade ?? 0;
        const maxAttempts = job.opts.attempts ?? env.WORKER_MAX_RETRIES + 1;
        if (attemptsMade >= maxAttempts) {
            logger.error({ jobId: job.id, err }, 'sms-send permanently failed → DLQ');
            await sms.finalizeFailure(job.data.smsMessageId, 'MAX_RETRIES', err.message);
            await audit.record({
                eventType: AUDIT_EVENTS.SMS_FAILED,
                actorType: 'system',
                targetType: 'sms_message',
                targetId: job.data.smsMessageId,
                metadata: { reason: err.message, attempts: attemptsMade },
                correlationId: job.data.correlationId,
            });
            await dlq.add('sms.dlq', job.data, { removeOnComplete: { age: 7 * 24 * 3600 } });
            if (job.data.tokenTransactionId) {
                await tokens.refund(job.data.tokenTransactionId, 'sms_failed_after_retries');
            }
            metrics.smsSent.labels({ device: 'n/a', result: 'failed' }).inc();
        }
    });
    return {
        worker,
        shutdown: async () => {
            await worker.close();
            await dlq.close();
            await connectionClient.quit().catch(() => undefined);
            await dlqClient.quit().catch(() => undefined);
            await prisma.$disconnect();
        },
    };
}
