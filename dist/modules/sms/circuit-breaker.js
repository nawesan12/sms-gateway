import { CircuitState } from '@prisma/client';
export class DeviceCircuitBreaker {
    prisma;
    env;
    logger;
    constructor(prisma, env, logger) {
        this.prisma = prisma;
        this.env = env;
        this.logger = logger;
    }
    async recordSuccess(deviceId) {
        await this.prisma.device.update({
            where: { id: deviceId },
            data: {
                failureCount: 0,
                circuitState: CircuitState.CLOSED,
                circuitOpenedAt: null,
            },
        });
    }
    async recordFailure(deviceId) {
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
    isAvailable(device) {
        if (device.circuitState === CircuitState.CLOSED)
            return true;
        if (device.circuitState === CircuitState.HALF_OPEN)
            return true;
        if (device.circuitState === CircuitState.OPEN) {
            if (!device.circuitOpenedAt)
                return true;
            const elapsed = Date.now() - device.circuitOpenedAt.getTime();
            return elapsed >= this.env.CIRCUIT_RESET_TIMEOUT_MS;
        }
        return false;
    }
    async halfOpen(deviceId) {
        await this.prisma.device.update({
            where: { id: deviceId },
            data: { circuitState: CircuitState.HALF_OPEN },
        });
    }
}
