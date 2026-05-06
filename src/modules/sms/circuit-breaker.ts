import { CircuitState, type Device, type PrismaClient } from '@prisma/client';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';

export class DeviceCircuitBreaker {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly env: AppEnv,
    private readonly logger: AppLogger,
  ) {}

  async recordSuccess(deviceId: string): Promise<void> {
    await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        failureCount: 0,
        circuitState: CircuitState.CLOSED,
        circuitOpenedAt: null,
      },
    });
  }

  async recordFailure(deviceId: string): Promise<Device> {
    const device = await this.prisma.device.findUniqueOrThrow({ where: { id: deviceId } });
    const failures = device.failureCount + 1;
    const shouldOpen = failures >= this.env.CIRCUIT_FAILURE_THRESHOLD;
    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        failureCount: failures,
        circuitState: shouldOpen ? CircuitState.OPEN : device.circuitState,
        circuitOpenedAt: shouldOpen ? new Date() : device.circuitOpenedAt,
      },
    });
    if (shouldOpen) {
      this.logger.warn({ deviceId, failures }, 'circuit opened');
    }
    return updated;
  }

  isAvailable(device: Device): boolean {
    if (device.circuitState === CircuitState.CLOSED) return true;
    if (device.circuitState === CircuitState.HALF_OPEN) return true;
    if (device.circuitState === CircuitState.OPEN) {
      if (!device.circuitOpenedAt) return true;
      const elapsed = Date.now() - device.circuitOpenedAt.getTime();
      return elapsed >= this.env.CIRCUIT_RESET_TIMEOUT_MS;
    }
    return false;
  }

  async halfOpen(deviceId: string): Promise<void> {
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { circuitState: CircuitState.HALF_OPEN },
    });
  }
}
