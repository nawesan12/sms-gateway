import {
  CampaignStatus,
  DeliveryStatus,
  type Prisma,
  PrismaClient,
} from '@prisma/client';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';
import { QUEUE_NAMES } from '@/config/constants.js';

export interface CampaignWatchdogHandle {
  shutdown: () => Promise<void>;
}

const TICK_INTERVAL_MS = 60_000;
// Grace period antes de considerar deliveries como huérfanas. Evita re-encolar
// jobs que recién se crearon y todavía esperan su nextRunAt según el throughput.
const ORPHAN_GRACE_MS = 5 * 60_000;

// Watchdog de campañas: corre en proceso cada 60s y se encarga de:
//   1) Detectar cuando una campaña cruza el 50% (halfwayNotifiedAt).
//   2) Cerrar campañas RUNNING cuyo pending llegó a 0 (defensivo — el worker
//      ya lo hace al procesar el último delivery, este es safety-net).
//   3) Auto-heal: si una delivery PENDING quedó huérfana (sin Job activo),
//      la re-encola respetando el throughput de la campaña.
export function startCampaignWatchdog(env: AppEnv, logger: AppLogger): CampaignWatchdogHandle {
  const prisma = new PrismaClient();

  const tick = async (): Promise<void> => {
    try {
      const campaigns = await prisma.campaign.findMany({
        where: { status: { in: [CampaignStatus.QUEUED, CampaignStatus.RUNNING] } },
        select: {
          id: true,
          status: true,
          totalRecipients: true,
          halfwayNotifiedAt: true,
          launchedAt: true,
          messagesPerHour: true,
        },
      });
      if (campaigns.length === 0) return;

      for (const c of campaigns) {
        const counts = await prisma.campaignDelivery.groupBy({
          by: ['status'],
          where: { campaignId: c.id },
          _count: { _all: true },
        });
        const summary = { PENDING: 0, SENT: 0, DELIVERED: 0, FAILED: 0, SKIPPED: 0 };
        for (const row of counts) summary[row.status] = row._count._all;
        const processed = summary.SENT + summary.DELIVERED + summary.FAILED + summary.SKIPPED;
        const progress = c.totalRecipients > 0 ? processed / c.totalRecipients : 0;

        // 1) Halfway notice (una sola vez por campaña).
        if (progress >= 0.5 && !c.halfwayNotifiedAt) {
          await prisma.campaign.update({
            where: { id: c.id },
            data: { halfwayNotifiedAt: new Date() },
          });
          logger.info(
            {
              campaignId: c.id,
              sent: summary.SENT,
              failed: summary.FAILED,
              total: c.totalRecipients,
            },
            'campaign halfway',
          );
        }

        // 2) Completion safety-net.
        if (summary.PENDING === 0 && c.status === CampaignStatus.RUNNING) {
          await prisma.campaign.updateMany({
            where: { id: c.id, status: CampaignStatus.RUNNING },
            data: { status: CampaignStatus.COMPLETED, completedAt: new Date() },
          });
          logger.info(
            {
              campaignId: c.id,
              sent: summary.SENT,
              failed: summary.FAILED,
              total: c.totalRecipients,
            },
            'campaign completed (watchdog)',
          );
          continue;
        }

        // 3) Auto-heal de deliveries huérfanas (PENDING sin Job activo).
        // Solo después del grace period — al principio los jobs todavía
        // están esperando su nextRunAt según el throughput configurado.
        if (
          c.launchedAt &&
          Date.now() - c.launchedAt.getTime() > ORPHAN_GRACE_MS &&
          summary.PENDING > 0
        ) {
          const pendingDeliveries = await prisma.campaignDelivery.findMany({
            where: { campaignId: c.id, status: DeliveryStatus.PENDING },
            select: { id: true },
          });
          const pendingIds = pendingDeliveries.map((d) => d.id);

          // Buscamos jobs activos (PENDING/RUNNING) en la queue de campañas
          // cuyo payload.deliveryId esté en nuestro set. Postgres permite
          // indexar por expresión JSON, pero acá la lista es chica (max ~
          // miles), así que un scan está bien.
          const activeJobs = await prisma.$queryRaw<Array<{ delivery_id: string }>>`
            SELECT payload->>'deliveryId' AS delivery_id
            FROM "jobs"
            WHERE queue = ${QUEUE_NAMES.CAMPAIGN_SEND}
              AND status IN ('PENDING'::"JobStatus", 'RUNNING'::"JobStatus")
              AND payload->>'deliveryId' = ANY(${pendingIds}::text[])
          `;
          const covered = new Set(activeJobs.map((j) => j.delivery_id));
          const orphans = pendingIds.filter((id) => !covered.has(id));

          if (orphans.length > 0) {
            const mph = c.messagesPerHour > 0 ? c.messagesPerHour : 100;
            const intervalMs = Math.floor(3_600_000 / mph);
            const now = new Date();
            await prisma.job.createMany({
              data: orphans.map((deliveryId, idx) => ({
                queue: QUEUE_NAMES.CAMPAIGN_SEND,
                payload: {
                  deliveryId,
                  campaignId: c.id,
                  correlationId: `watchdog-${Date.now()}`,
                } as Prisma.InputJsonValue,
                maxAttempts: env.WORKER_MAX_RETRIES + 1,
                nextRunAt: new Date(now.getTime() + idx * intervalMs),
              })),
            });
            logger.warn(
              { campaignId: c.id, orphans: orphans.length, mph },
              'auto-healed orphan deliveries',
            );
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'campaign-watchdog tick failed');
    }
  };

  // Primer tick a los 5s (que arranque el worker normal primero), después cada 60s.
  const kickoff = setTimeout(() => void tick(), 5_000);
  const handle = setInterval(() => void tick(), TICK_INTERVAL_MS);

  return {
    shutdown: async () => {
      clearTimeout(kickoff);
      clearInterval(handle);
      await prisma.$disconnect();
    },
  };
}
