import { DeviceStatus, type Device, type PrismaClient } from '@prisma/client';
import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';
import { DeviceCircuitBreaker } from './circuit-breaker.js';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';

export class DeviceRouter {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly breaker: DeviceCircuitBreaker,
    private readonly logger: AppLogger,
  ) {}

  static create(prisma: PrismaClient, env: AppEnv, logger: AppLogger): DeviceRouter {
    return new DeviceRouter(prisma, new DeviceCircuitBreaker(prisma, env, logger), logger);
  }

  async listEligible(): Promise<Device[]> {
    // Incluimos ACTIVE y OFFLINE: FCM despierta al celu aunque esté en Doze Mode,
    // así que un heartbeat atrasado (que el worker marca como OFFLINE) no es
    // motivo para skipear el device. INACTIVE (deshabilitado manualmente) y
    // suspectedBlocked (el watchdog detectó SIM bloqueada por la operadora)
    // quedan fuera. Sin fcmToken tampoco — la app no se registró todavía.
    const devices = await this.prisma.device.findMany({
      where: {
        status: { in: [DeviceStatus.ACTIVE, DeviceStatus.OFFLINE] },
        fcmToken: { not: null },
        suspectedBlocked: false,
      },
      orderBy: [{ status: 'asc' }, { priority: 'asc' }, { lastHeartbeat: 'desc' }],
    });
    return devices.filter((d) => this.breaker.isAvailable(d));
  }

  async select(excludeIds: string[] = []): Promise<Device> {
    const eligible = (await this.listEligible()).filter((d) => !excludeIds.includes(d.id));
    if (eligible.length === 0) {
      throw new AppError(ERROR_CODES.DEVICE_OFFLINE, 'No active SMS devices available', 503);
    }
    // Round-robin persistente: elegimos el device con menor `routerLoadCount`.
    // Si el reset diario quedó viejo (>24h), lo refrescamos primero. Esto
    // distribuye carga entre SIMs uniformemente, evitando quemar una sola.
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const staleIds = eligible
      .filter((d) => !d.routerLoadResetAt || d.routerLoadResetAt < oneDayAgo)
      .map((d) => d.id);
    if (staleIds.length > 0) {
      await this.prisma.device.updateMany({
        where: { id: { in: staleIds } },
        data: { routerLoadCount: 0, routerLoadResetAt: now },
      });
      for (const d of eligible) {
        if (staleIds.includes(d.id)) {
          d.routerLoadCount = 0;
          d.routerLoadResetAt = now;
        }
      }
    }
    // Orden: menor load primero, después priority, después heartbeat más reciente.
    eligible.sort((a, b) => {
      if (a.routerLoadCount !== b.routerLoadCount) {
        return a.routerLoadCount - b.routerLoadCount;
      }
      if (a.priority !== b.priority) return a.priority - b.priority;
      const tA = a.lastHeartbeat?.getTime() ?? 0;
      const tB = b.lastHeartbeat?.getTime() ?? 0;
      return tB - tA;
    });
    const chosen = eligible[0]!;
    // Incremento atómico del load count para que llamadas concurrentes
    // vean el contador actualizado.
    await this.prisma.device.update({
      where: { id: chosen.id },
      data: { routerLoadCount: { increment: 1 } },
    });
    this.logger.debug(
      { deviceId: chosen.id, name: chosen.name, load: chosen.routerLoadCount + 1 },
      'device selected',
    );
    return chosen;
  }

  get circuitBreaker(): DeviceCircuitBreaker {
    return this.breaker;
  }
}
