import { DeviceStatus, PrismaClient } from '@prisma/client';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';
import { purgeOldJobs } from '../pg-worker.js';

export interface DeviceHealthWorkerHandle {
  shutdown: () => Promise<void>;
}

// Marca devices OFFLINE si no mandaron heartbeat en DEVICE_OFFLINE_AFTER_SEC.
// Antes corría como un BullMQ Job repetido cada 60s; ahora es un setInterval
// directo en proceso (no necesita persistencia: si el server se reinicia, el
// próximo tick lo hace en 60s y nada queda inconsistente).
//
// Adicionalmente: limpia jobs viejos COMPLETED/DEAD para que la tabla `jobs`
// no crezca para siempre.
export function startDeviceHealthWorker(env: AppEnv, logger: AppLogger): DeviceHealthWorkerHandle {
  const prisma = new PrismaClient();

  const tick = async (): Promise<void> => {
    try {
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
      await purgeOldJobs(prisma);
    } catch (err) {
      logger.error({ err }, 'device-health tick failed');
    }
  };

  // Primer tick al toque, después cada 60s.
  void tick();
  const handle = setInterval(() => void tick(), 60_000);

  return {
    shutdown: async () => {
      clearInterval(handle);
      await prisma.$disconnect();
    },
  };
}
