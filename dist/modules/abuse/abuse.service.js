import { BlacklistType } from '@prisma/client';
import { BlacklistRepository } from './blacklist.repository.js';
export class AbuseService {
    logger;
    repo;
    constructor(prisma, logger) {
        this.logger = logger;
        this.repo = new BlacklistRepository(prisma);
    }
    async check(input) {
        const phoneHit = await this.repo.isBlacklisted(BlacklistType.PHONE, input.phoneE164);
        if (phoneHit) {
            this.logger.warn({ phone: input.phoneE164, reason: phoneHit.reason }, 'phone blacklisted');
            return { blocked: true, reason: phoneHit.reason ?? 'phone_blacklisted' };
        }
        if (input.ipAddress) {
            const ipHit = await this.repo.isBlacklisted(BlacklistType.IP, input.ipAddress);
            if (ipHit) {
                this.logger.warn({ ip: input.ipAddress, reason: ipHit.reason }, 'ip blacklisted');
                return { blocked: true, reason: ipHit.reason ?? 'ip_blacklisted' };
            }
        }
        return { blocked: false };
    }
    get repository() {
        return this.repo;
    }
}
