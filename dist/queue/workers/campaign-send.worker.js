import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { CampaignStatus, DeliveryStatus, PrismaClient } from '@prisma/client';
import { AUDIT_EVENTS, ERROR_CODES, QUEUE_NAMES } from '../../config/constants.js';
import { TextBeeProvider } from '../../modules/sms/providers/textbee.provider.js';
import { SmsService } from '../../modules/sms/sms.service.js';
import { DeviceRouter } from '../../modules/sms/device-router.js';
import { DeviceCrypto } from '../../modules/devices/crypto.js';
import { TokensService } from '../../modules/tokens/tokens.service.js';
import { AuditService } from '../../modules/audit/audit.service.js';
import { renderTemplate } from '../../lib/template.js';
export function startCampaignSendWorker(env, logger) {
    const prisma = new PrismaClient();
    const provider = new TextBeeProvider(env, logger);
    const crypto = new DeviceCrypto(env.MASTER_ENCRYPTION_KEY_B64);
    const router = DeviceRouter.create(prisma, env, logger);
    const sms = new SmsService(prisma, env, logger, provider, router, crypto);
    const tokens = new TokensService(prisma, logger);
    const audit = new AuditService(prisma, logger);
    const connectionClient = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    const worker = new Worker(QUEUE_NAMES.CAMPAIGN_SEND, async (job) => {
        const { deliveryId, campaignId, correlationId } = job.data;
        const childLog = logger.child({ jobId: job.id, deliveryId, campaignId, correlationId });
        const delivery = await prisma.campaignDelivery.findUnique({
            where: { id: deliveryId },
            include: { contact: true, campaign: true },
        });
        if (!delivery) {
            childLog.warn('delivery not found, skipping');
            return { ok: false };
        }
        if (delivery.status !== DeliveryStatus.PENDING) {
            childLog.debug({ status: delivery.status }, 'delivery already processed');
            return { ok: false };
        }
        if (delivery.campaign.status === CampaignStatus.CANCELED ||
            delivery.campaign.status === CampaignStatus.PAUSED) {
            await prisma.campaignDelivery.update({
                where: { id: deliveryId },
                data: { status: DeliveryStatus.SKIPPED },
            });
            return { ok: false };
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
            return { ok: false };
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
                childLog.warn({ ownerUserId, balance: reservation.balance }, 'campaign paused: insufficient tokens');
                return { ok: false };
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
            }
            else {
                await tokens.refund(reservation.transactionId, 'campaign_dispatch_failed');
                await sms.finalizeFailure(smsId, result.errorCode ?? 'UNKNOWN', result.errorMessage ?? 'send failed');
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
                        data: { failedCount: { increment: 1 } },
                    }),
                ]);
            }
        }
        catch (err) {
            childLog.warn({ err }, 'campaign delivery dispatch error');
            await prisma.$transaction([
                prisma.campaignDelivery.update({
                    where: { id: deliveryId },
                    data: {
                        status: DeliveryStatus.FAILED,
                        errorCode: 'DISPATCH_ERROR',
                        errorMessage: err.message,
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
            await prisma.campaign.update({
                where: { id: campaignId },
                data: { status: CampaignStatus.COMPLETED, completedAt: new Date() },
            });
            childLog.info('campaign completed');
        }
        return { ok: true };
    }, {
        connection: connectionClient,
        concurrency: env.WORKER_CONCURRENCY,
        // Conservative global rate limiter: respect average TPS across all campaigns.
        // Per-campaign tpsLimit is informative; tighter limits would require
        // multiple queues. For MVP: max 5 SMS/sec global.
        limiter: { max: 5, duration: 1000 },
    });
    worker.on('failed', (job, err) => {
        if (!job)
            return;
        logger.warn({ jobId: job.id, err: err.message }, 'campaign-send job failed');
    });
    return {
        worker,
        shutdown: async () => {
            await worker.close();
            await connectionClient.quit().catch(() => undefined);
            await prisma.$disconnect();
        },
    };
}
