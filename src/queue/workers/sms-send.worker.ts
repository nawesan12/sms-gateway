import { PrismaClient } from '@prisma/client';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';
import { AUDIT_EVENTS } from '@/config/constants.js';
import { FcmProvider } from '@/modules/sms/providers/fcm.provider.js';
import { SmsService } from '@/modules/sms/sms.service.js';
import { DeviceRouter } from '@/modules/sms/device-router.js';
import { AuditService } from '@/modules/audit/audit.service.js';
import { TokensService } from '@/modules/tokens/tokens.service.js';
import { initFcmFromEnv } from '@/lib/fcm-init.js';
import { metrics } from '@/plugins/metrics.js';
import { QUEUE_NAMES } from '@/config/constants.js';
import { PgWorker } from '../pg-worker.js';
import { buildDlqQueue } from '../queues.js';
import type { SmsSendJob } from '../jobs/job.types.js';

export interface SmsSendWorkerHandle {
  worker: PgWorker<SmsSendJob>;
  shutdown: () => Promise<void>;
}

// Maneja attempt updates manualmente (antes lo hacía BullMQ via job.updateData),
// pero como el payload no muta tras claim, guardamos los devices excluidos
// dentro del propio Job en sucesivos intentos via prisma directamente.
export function startSmsSendWorker(env: AppEnv, logger: AppLogger): SmsSendWorkerHandle {
  const prisma = new PrismaClient();
  const fcm = initFcmFromEnv(env, logger);
  const provider = new FcmProvider(fcm, logger);
  const router = DeviceRouter.create(prisma, env, logger);
  const audit = new AuditService(prisma, logger);
  const tokens = new TokensService(prisma, logger);
  const dlq = buildDlqQueue(prisma);
  const sms = new SmsService(prisma, env, logger, provider, router);

  const worker = new PgWorker<SmsSendJob>(
    prisma,
    QUEUE_NAMES.SMS_SEND,
    async (job) => {
      const { smsMessageId, recipientE164, message, correlationId } = job.data;
      const exclude = job.data.excludeDeviceIds ?? [];
      const childLog = logger.child({ jobId: job.id, smsMessageId, correlationId });

      if (job.attempts > 1) {
        await sms.bumpRetry(smsMessageId);
      }

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
        return;
      }

      // Failed: persistir el device como excluido en el payload del job para
      // que el próximo retry no lo elija.
      const newExclude = [...exclude, device.id];
      await prisma.job.update({
        where: { id: job.id },
        data: {
          payload: {
            ...job.data,
            excludeDeviceIds: newExclude,
          },
        },
      });
      childLog.warn(
        { errorCode: result.errorCode, errorMessage: result.errorMessage },
        'sms-send provider failed, throwing for retry',
      );
      throw new Error(
        `provider error: ${result.errorCode ?? 'unknown'} ${result.errorMessage ?? ''}`,
      );
    },
    logger,
    {
      concurrency: env.WORKER_CONCURRENCY,
      backoffMs: env.WORKER_BACKOFF_MS,
      onPermanentFailure: async (job, err) => {
        logger.error({ jobId: job.id, err: err.message }, 'sms-send permanently failed → DLQ');
        await sms.finalizeFailure(job.data.smsMessageId, 'MAX_RETRIES', err.message);
        await audit.record({
          eventType: AUDIT_EVENTS.SMS_FAILED,
          actorType: 'system',
          targetType: 'sms_message',
          targetId: job.data.smsMessageId,
          metadata: { reason: err.message, attempts: job.attempts },
          correlationId: job.data.correlationId,
        });
        await dlq.add(job.data);
        if (job.data.tokenTransactionId) {
          await tokens.refund(job.data.tokenTransactionId, 'sms_failed_after_retries');
        }
        metrics.smsSent.labels({ device: 'n/a', result: 'failed' }).inc();
      },
    },
  );

  worker.start();

  return {
    worker,
    shutdown: async () => {
      await worker.stop();
      await prisma.$disconnect();
    },
  };
}
