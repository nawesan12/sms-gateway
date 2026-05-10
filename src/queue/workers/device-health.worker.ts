import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { DeviceStatus, PrismaClient } from '@prisma/client';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';
import { QUEUE_NAMES } from '@/config/constants.js';
import type { DeviceHealthJob } from '../jobs/job.types.js';
import { buildDeviceHealthQueue } from '../queues.js';

export interface DeviceHealthWorkerHandle {
  worker: Worker<DeviceHealthJob>;
  shutdown: () => Promise<void>;
}

export async function startDeviceHealthWorker(
  env: AppEnv,
  logger: AppLogger,
): Promise<DeviceHealthWorkerHandle> {
  const prisma = new PrismaClient();
  const { queue, client: queueClient } = buildDeviceHealthQueue(env);

  // Tick cada 60s. La app Android manda heartbeat cada N (la app upstream
  // mandaba cada 5 min). Si no recibimos heartbeat en DEVICE_OFFLINE_AFTER_SEC,
  // marcamos OFFLINE.
  await queue.add(
    'device.health.tick',
    { triggeredAt: Date.now() },
    {
      repeat: { every: 60_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  );

  const connectionClient = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new Worker<DeviceHealthJob>(
    QUEUE_NAMES.DEVICE_HEALTH,
    async (_job: Job<DeviceHealthJob>) => {
      const cutoff = new Date(Date.now() - env.DEVICE_OFFLINE_AFTER_SEC * 1000);
      const result = await prisma.device.updateMany({
        where: {
          status: DeviceStatus.ACTIVE,
          OR: [{ lastHeartbeat: null }, { lastHeartbeat: { lt: cutoff } }],
        },
        data: { status: DeviceStatus.OFFLINE },
      });
      if (result.count > 0) {
        logger.info({ marked: result.count }, 'device-health: marked devices OFFLINE');
      }
      return { marked: result.count };
    },
    { connection: connectionClient, concurrency: 1 },
  );

  return {
    worker,
    shutdown: async () => {
      await worker.close();
      await queue.close();
      await connectionClient.quit().catch(() => undefined);
      await queueClient.quit().catch(() => undefined);
      await prisma.$disconnect();
    },
  };
}
