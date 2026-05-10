import { DeviceStatus } from '@prisma/client';
import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';
import { DeviceCircuitBreaker } from './circuit-breaker.js';
export class DeviceRouter {
    prisma;
    breaker;
    logger;
    cursor = 0;
    constructor(prisma, breaker, logger) {
        this.prisma = prisma;
        this.breaker = breaker;
        this.logger = logger;
    }
    static create(prisma, env, logger) {
        return new DeviceRouter(prisma, new DeviceCircuitBreaker(prisma, env, logger), logger);
    }
    async listEligible() {
        const devices = await this.prisma.device.findMany({
            where: { status: DeviceStatus.ACTIVE },
            orderBy: [{ priority: 'asc' }, { lastHeartbeat: 'desc' }],
        });
        return devices.filter((d) => this.breaker.isAvailable(d));
    }
    async select(excludeIds = []) {
        const eligible = (await this.listEligible()).filter((d) => !excludeIds.includes(d.id));
        if (eligible.length === 0) {
            throw new AppError(ERROR_CODES.DEVICE_OFFLINE, 'No active SMS devices available', 503);
        }
        const idx = this.cursor % eligible.length;
        this.cursor = (this.cursor + 1) % Math.max(eligible.length, 1);
        const chosen = eligible[idx];
        this.logger.debug({ deviceId: chosen.id, name: chosen.name }, 'device selected');
        return chosen;
    }
    get circuitBreaker() {
        return this.breaker;
    }
}
