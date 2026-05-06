import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';
import { QUEUE_NAMES } from '@/config/constants.js';
import { TextBeeProvider } from '@/modules/sms/providers/textbee.provider.js';
import { DevicesService } from '@/modules/devices/devices.service.js';
import { DeviceCrypto } from '@/modules/devices/crypto.js';
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
  const provider = new TextBeeProvider(env, logger);
  const crypto = new DeviceCrypto(env.MASTER_ENCRYPTION_KEY_B64);
  const devices = new DevicesService(prisma, crypto, logger);
  const { queue, client: queueClient } = buildDeviceHealthQueue(env);

  // Schedule recurring job every 60s.
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
      // TextBee no expone un GET de status de device confiable. Hacemos
      // healthcheck pasivo: solo refrescamos lastHeartbeat de devices que
      // tuvieron envíos exitosos recientes; el circuit-breaker se encarga
      // de marcar OPEN cuando hay fallos.
      const list = await devices.listEligibleForHealthCheck();
      for (const device of list) {
        try {
          const apiKey = devices.decryptApiKey(device);
          const status = await provider.getDeviceStatus({
            textbeeDeviceId: device.textbeeDeviceId,
            apiKey,
          });
          // Si el provider no nos da info útil (TextBee 404), no degradamos
          // status: solo lo bajamos a OFFLINE si circuit está OPEN.
          if (status.online) {
            await devices.updateHeartbeat(device.id, true, status.batteryLevel ?? null);
          }
        } catch (err) {
          logger.warn({ err, deviceId: device.id }, 'device health check skipped');
        }
      }
      return { checked: list.length };
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
