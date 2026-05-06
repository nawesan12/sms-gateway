import { DeviceStatus, type Device, type PrismaClient } from '@prisma/client';
import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';
import { DeviceCircuitBreaker } from './circuit-breaker.js';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';

export class DeviceRouter {
  private cursor = 0;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly breaker: DeviceCircuitBreaker,
    private readonly logger: AppLogger,
  ) {}

  static create(prisma: PrismaClient, env: AppEnv, logger: AppLogger): DeviceRouter {
    return new DeviceRouter(prisma, new DeviceCircuitBreaker(prisma, env, logger), logger);
  }

  async listEligible(): Promise<Device[]> {
    const devices = await this.prisma.device.findMany({
      where: { status: DeviceStatus.ACTIVE },
      orderBy: [{ priority: 'asc' }, { lastHeartbeat: 'desc' }],
    });
    return devices.filter((d) => this.breaker.isAvailable(d));
  }

  async select(excludeIds: string[] = []): Promise<Device> {
    const eligible = (await this.listEligible()).filter((d) => !excludeIds.includes(d.id));
    if (eligible.length === 0) {
      throw new AppError(ERROR_CODES.DEVICE_OFFLINE, 'No active SMS devices available', 503);
    }
    const idx = this.cursor % eligible.length;
    this.cursor = (this.cursor + 1) % Math.max(eligible.length, 1);
    const chosen = eligible[idx]!;
    this.logger.debug({ deviceId: chosen.id, name: chosen.name }, 'device selected');
    return chosen;
  }

  get circuitBreaker(): DeviceCircuitBreaker {
    return this.breaker;
  }
}
