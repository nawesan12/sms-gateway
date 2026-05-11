import { CampaignStatus, DeliveryStatus, PrismaClient } from '@prisma/client';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';
import { AUDIT_EVENTS, ERROR_CODES, QUEUE_NAMES } from '@/config/constants.js';
import { FcmProvider } from '@/modules/sms/providers/fcm.provider.js';
import { SmsService } from '@/modules/sms/sms.service.js';
import { DeviceRouter } from '@/modules/sms/device-router.js';
import { initFcmFromEnv } from '@/lib/fcm-init.js';
import { TokensService } from '@/modules/tokens/tokens.service.js';
import { AuditService } from '@/modules/audit/audit.service.js';
import { renderTemplate } from '@/lib/template.js';
import { PgWorker } from '../pg-worker.js';
import type { CampaignSendJob } from '../jobs/job.types.js';

export interface CampaignWorkerHandle {
  worker: PgWorker<CampaignSendJob>;
  shutdown: () => Promise<void>;
}

// Errores de FCM que jamás se van a recuperar reintentando: el problema es
// configuración (env var ausente) o estado del device (sin token). Pausar
// la campaña entera evita gastar tokens en envíos imposibles.
const FATAL_FCM_CODES = new Set(['NO_FCM_CONFIG', 'NO_FCM_TOKEN']);

export function startCampaignSendWorker(env: AppEnv, logger: AppLogger): CampaignWorkerHandle {
  const prisma = new PrismaClient();
  const fcm = initFcmFromEnv(env, logger);
  const provider = new FcmProvider(fcm, logger);
  const router = DeviceRouter.create(prisma, env, logger);
  const tokens = new TokensService(prisma, logger);
  const audit = new AuditService(prisma, logger);
  const sms = new SmsService(prisma, env, logger, provider, router);

  const worker = new PgWorker<CampaignSendJob>(
    prisma,
    QUEUE_NAMES.CAMPAIGN_SEND,
    async (job) => {
      const { deliveryId, campaignId, correlationId } = job.data;
      const childLog = logger.child({ jobId: job.id, deliveryId, campaignId, correlationId });

      const delivery = await prisma.campaignDelivery.findUnique({
        where: { id: deliveryId },
        include: { contact: true, campaign: true },
      });
      if (!delivery) {
        childLog.warn('delivery not found, skipping');
        return;
      }
      if (delivery.status !== DeliveryStatus.PENDING) {
        childLog.debug({ status: delivery.status }, 'delivery already processed');
        return;
      }
      if (
        delivery.campaign.status === CampaignStatus.CANCELED ||
        delivery.campaign.status === CampaignStatus.PAUSED
      ) {
        await prisma.campaignDelivery.update({
          where: { id: deliveryId },
          data: { status: DeliveryStatus.SKIPPED },
        });
        return;
      }

      // Transition campaign to RUNNING on first delivery
      if (delivery.campaign.status === CampaignStatus.QUEUED) {
        await prisma.campaign.updateMany({
          where: { id: campaignId, status: CampaignStatus.QUEUED },
          data: { status: CampaignStatus.RUNNING },
        });
      }

      const message = renderTemplate(delivery.campaign.messageTemplate, {
        name: delivery.contact.name ?? '',
        phone: delivery.contact.phoneE164,
      });

      // ownerUserId obligatorio para debitar tokens de la campaña.
      const ownerUserId = delivery.campaign.ownerUserId;
      if (!ownerUserId) {
        childLog.error('campaign without ownerUserId — cannot debit tokens, marking failed');
        await prisma.$transaction([
          prisma.campaignDelivery.update({
            where: { id: deliveryId },
            data: {
              status: DeliveryStatus.FAILED,
              errorCode: 'NO_OWNER',
              errorMessage: 'Campaign has no ownerUserId',
            },
          }),
          prisma.campaign.update({
            where: { id: campaignId },
            data: { failedCount: { increment: 1 }, status: CampaignStatus.FAILED },
          }),
        ]);
        return;
      }

      try {
        const device = await router.select();
        const smsId = await sms.createPending({
          deviceId: device.id,
          recipientE164: delivery.contact.phoneE164,
        });

        const reservation = await tokens.reserve({
          userId: ownerUserId,
          amount: 1,
          smsMessageId: smsId,
          reason: 'sms.campaign',
          correlationId,
        });
        if (!reservation.ok) {
          await sms.finalizeFailure(smsId, ERROR_CODES.INSUFFICIENT_TOKENS, 'no token balance');
          await prisma.$transaction([
            prisma.campaignDelivery.update({
              where: { id: deliveryId },
              data: {
                status: DeliveryStatus.FAILED,
                smsMessageId: smsId,
                errorCode: ERROR_CODES.INSUFFICIENT_TOKENS,
                errorMessage: `balance=${reservation.balance}`,
              },
            }),
            prisma.campaign.update({
              where: { id: campaignId },
              data: {
                failedCount: { increment: 1 },
                status: CampaignStatus.PAUSED,
              },
            }),
          ]);
          await audit.record({
            eventType: AUDIT_EVENTS.CAMPAIGN_PAUSED_INSUFFICIENT_TOKENS,
            actorType: 'system',
            actorId: ownerUserId,
            targetType: 'campaign',
            targetId: campaignId,
            correlationId,
            metadata: { ownerUserId, balance: reservation.balance, deliveryId },
          });
          childLog.warn(
            { ownerUserId, balance: reservation.balance },
            'campaign paused: insufficient tokens',
          );
          return;
        }

        await prisma.smsMessage.update({
          where: { id: smsId },
          data: { tokenTransactionId: reservation.transactionId },
        });

        const { result } = await sms.dispatch({
          smsMessageId: smsId,
          recipientE164: delivery.contact.phoneE164,
          message,
        });

        if (result.ok) {
          await tokens.commit(reservation.transactionId);
          await prisma.$transaction([
            prisma.campaignDelivery.update({
              where: { id: deliveryId },
              data: {
                status: DeliveryStatus.SENT,
                smsMessageId: smsId,
                sentAt: new Date(),
              },
            }),
            prisma.campaign.update({
              where: { id: campaignId },
              data: { sentCount: { increment: 1 } },
            }),
          ]);
        } else {
          await tokens.refund(reservation.transactionId, 'campaign_dispatch_failed');
          await sms.finalizeFailure(
            smsId,
            result.errorCode ?? 'UNKNOWN',
            result.errorMessage ?? 'send failed',
          );

          // Si el error es fatal del lado FCM (env var sin setear, device sin
          // token), no tiene sentido seguir procesando deliveries de esta
          // campaña — pausamos para que el operador arregle el problema.
          const fatal = result.errorCode && FATAL_FCM_CODES.has(result.errorCode);
          await prisma.$transaction([
            prisma.campaignDelivery.update({
              where: { id: deliveryId },
              data: {
                status: DeliveryStatus.FAILED,
                smsMessageId: smsId,
                errorCode: result.errorCode ?? null,
                errorMessage: result.errorMessage ?? null,
              },
            }),
            prisma.campaign.update({
              where: { id: campaignId },
              data: {
                failedCount: { increment: 1 },
                ...(fatal ? { status: CampaignStatus.PAUSED } : {}),
              },
            }),
          ]);
          if (fatal) {
            await audit.record({
              eventType: AUDIT_EVENTS.CAMPAIGN_PAUSED_INSUFFICIENT_TOKENS,
              actorType: 'system',
              actorId: ownerUserId,
              targetType: 'campaign',
              targetId: campaignId,
              correlationId,
              metadata: {
                reason: 'fcm_fatal',
                errorCode: result.errorCode,
                errorMessage: result.errorMessage,
              },
            });
            childLog.error(
              { errorCode: result.errorCode, errorMessage: result.errorMessage },
              'campaign paused: fatal FCM error — fix backend config and resume',
            );
          }
        }
      } catch (err) {
        childLog.warn({ err }, 'campaign delivery dispatch error');
        await prisma.$transaction([
          prisma.campaignDelivery.update({
            where: { id: deliveryId },
            data: {
              status: DeliveryStatus.FAILED,
              errorCode: 'DISPATCH_ERROR',
              errorMessage: (err as Error).message,
            },
          }),
          prisma.campaign.update({
            where: { id: campaignId },
            data: { failedCount: { increment: 1 } },
          }),
        ]);
      }

      // Check if campaign is fully done
      const remaining = await prisma.campaignDelivery.count({
        where: { campaignId, status: DeliveryStatus.PENDING },
      });
      if (remaining === 0) {
        // Solo transicionar a COMPLETED si todavía está corriendo (puede haber
        // ido a PAUSED por insufficient tokens o por fatal FCM, en ese caso
        // queremos respetar ese estado).
        await prisma.campaign.updateMany({
          where: { id: campaignId, status: CampaignStatus.RUNNING },
          data: { status: CampaignStatus.COMPLETED, completedAt: new Date() },
        });
        childLog.info('campaign completed');
      }
    },
    logger,
    {
      concurrency: env.WORKER_CONCURRENCY,
      backoffMs: env.WORKER_BACKOFF_MS,
      // Conservative global rate limiter: 5 SMS/sec across todas las campañas.
      limiter: { max: 5, durationMs: 1000 },
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
