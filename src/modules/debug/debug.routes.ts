import type { FastifyInstance } from 'fastify';
import { QUEUE_NAMES } from '@/config/constants.js';

// Endpoint para verificar tras cada deploy si el dispatch end-to-end está
// armado correctamente: FCM configurado, al menos 1 device con fcmToken,
// y profundidad de las queues. Útil cuando "no se mandan SMS" — devuelve
// señales claras de qué está mal.
export async function registerDebugRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/v1/debug/dispatch-check',
    {
      preHandler: app.requireAdmin,
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }, { bootstrapToken: [] }] },
    },
    async () => {
      const devices = await app.prisma.device.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          fcmToken: true,
          lastHeartbeat: true,
          batteryLevel: true,
        },
        orderBy: [{ status: 'asc' }, { priority: 'asc' }],
      });

      const now = Date.now();
      const devicesOut = devices.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        hasFcmToken: d.fcmToken !== null,
        lastHeartbeatAgoSec:
          d.lastHeartbeat === null ? null : Math.round((now - d.lastHeartbeat.getTime()) / 1000),
        batteryLevel: d.batteryLevel,
      }));

      const queueDepthRows = await app.prisma.job.groupBy({
        by: ['queue', 'status'],
        _count: { _all: true },
      });
      const queueDepth: Record<string, Record<string, number>> = {};
      for (const row of queueDepthRows) {
        queueDepth[row.queue] ??= {};
        queueDepth[row.queue]![row.status] = row._count._all;
      }

      return {
        success: true,
        data: {
          fcm: { configured: app.fcm !== null },
          devices: devicesOut,
          queues: {
            [QUEUE_NAMES.SMS_SEND]: queueDepth[QUEUE_NAMES.SMS_SEND] ?? {},
            [QUEUE_NAMES.CAMPAIGN_SEND]: queueDepth[QUEUE_NAMES.CAMPAIGN_SEND] ?? {},
            [QUEUE_NAMES.SMS_DLQ]: queueDepth[QUEUE_NAMES.SMS_DLQ] ?? {},
          },
        },
        error: null,
      };
    },
  );
}
