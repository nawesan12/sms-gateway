import { BlacklistType, type PrismaClient } from '@prisma/client';
import type { AppLogger } from '@/lib/logger-types.js';
import { BlacklistRepository } from './blacklist.repository.js';

export interface AbuseCheckInput {
  phoneE164: string;
  ipAddress: string | null;
}

export interface AbuseCheckResult {
  blocked: boolean;
  reason?: string;
}

export class AbuseService {
  private readonly repo: BlacklistRepository;

  constructor(
    prisma: PrismaClient,
    private readonly logger: AppLogger,
  ) {
    this.repo = new BlacklistRepository(prisma);
  }

  async check(input: AbuseCheckInput): Promise<AbuseCheckResult> {
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

  get repository(): BlacklistRepository {
    return this.repo;
  }
}
