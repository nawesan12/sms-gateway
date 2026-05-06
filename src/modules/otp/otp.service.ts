import argon2 from 'argon2';
import type { PrismaClient } from '@prisma/client';
import { generateNumericCode } from '@/lib/otp-code.js';
import { addSeconds, isExpired } from '@/lib/time.js';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';
import { OtpRepository } from './otp.repository.js';
import type { CreateOtpInput, CreateOtpResult, VerifyOtpResult } from './otp.types.js';

const ARGON_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
};

export class OtpService {
  private readonly repo: OtpRepository;

  constructor(
    prisma: PrismaClient,
    private readonly env: AppEnv,
    private readonly logger: AppLogger,
  ) {
    this.repo = new OtpRepository(prisma);
  }

  async hash(code: string): Promise<string> {
    return argon2.hash(code, ARGON_OPTS);
  }

  async verifyHash(hash: string, code: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, code);
    } catch {
      return false;
    }
  }

  async createOtp(input: CreateOtpInput): Promise<CreateOtpResult> {
    const code = generateNumericCode(this.env.OTP_LENGTH);
    const codeHash = await this.hash(code);
    const expiresAt = addSeconds(new Date(), this.env.OTP_TTL_SEC);

    const request = await this.repo.create({
      phoneE164: input.phoneE164,
      codeHash,
      expiresAt,
      maxAttempts: this.env.OTP_MAX_ATTEMPTS,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    return {
      requestId: request.id,
      expiresInSec: this.env.OTP_TTL_SEC,
      cooldownSec: this.env.RATE_LIMIT_PHONE_COOLDOWN_SEC,
      plainCode: code,
    };
  }

  async verifyOtp(phoneE164: string, code: string): Promise<VerifyOtpResult> {
    const active = await this.repo.findActiveByPhone(phoneE164);
    if (!active) {
      this.logger.debug({ phoneE164 }, 'no active otp');
      return { ok: false, reason: 'INVALID' };
    }
    if (isExpired(active.expiresAt)) {
      return { ok: false, reason: 'EXPIRED' };
    }
    if (active.consumedAt) {
      return { ok: false, reason: 'USED' };
    }
    if (active.attempts >= active.maxAttempts) {
      return { ok: false, reason: 'MAX_ATTEMPTS' };
    }

    const matches = await this.verifyHash(active.codeHash, code);
    if (!matches) {
      const updated = await this.repo.incrementAttempts(active.id);
      if (updated.attempts >= updated.maxAttempts) {
        await this.repo.consume(updated.id);
        return { ok: false, reason: 'MAX_ATTEMPTS' };
      }
      return { ok: false, reason: 'INVALID' };
    }

    await this.repo.consume(active.id);
    return { ok: true, userId: active.userId ?? '', phoneE164 };
  }

  buildMessage(code: string): string {
    const minutes = Math.max(1, Math.round(this.env.OTP_TTL_SEC / 60));
    return this.env.OTP_MESSAGE_TEMPLATE.replace('{{code}}', code).replace(
      '{{minutes}}',
      String(minutes),
    );
  }
}
