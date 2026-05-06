import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '@/../tests/helpers/test-app.js';
import { disconnectTestPrisma, getTestPrisma, truncateAll } from '@/../tests/helpers/test-db.js';
import { validArPhone } from '@/../tests/helpers/fixtures.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await disconnectTestPrisma();
});

beforeEach(async () => {
  await truncateAll(getTestPrisma());
});

async function seedActiveOtp(code: string, opts: { expiresInSec?: number; consumed?: boolean } = {}) {
  const prisma = getTestPrisma();
  const codeHash = await argon2.hash(code, { type: argon2.argon2id });
  return prisma.otpRequest.create({
    data: {
      phoneE164: validArPhone,
      codeHash,
      expiresAt: new Date(Date.now() + (opts.expiresInSec ?? 300) * 1000),
      consumedAt: opts.consumed ? new Date() : null,
    },
  });
}

describe('POST /v1/auth/verify-code', () => {
  it('codigo correcto → tokens', async () => {
    await seedActiveOtp('424242');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-code',
      payload: { phone: validArPhone, code: '424242' },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.accessToken).toBeTypeOf('string');
    expect(data.refreshToken).toBeTypeOf('string');
    expect(data.user.phoneE164).toBe(validArPhone);
  });

  it('codigo invalido → OTP_INVALID y attempts++', async () => {
    const otp = await seedActiveOtp('424242');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-code',
      payload: { phone: validArPhone, code: '000000' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('OTP_INVALID');
    const refreshed = await getTestPrisma().otpRequest.findUnique({ where: { id: otp.id } });
    expect(refreshed!.attempts).toBe(1);
  });

  it('expirado → OTP_INVALID (no revela)', async () => {
    await seedActiveOtp('424242', { expiresInSec: -10 });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-code',
      payload: { phone: validArPhone, code: '424242' },
    });
    // No active OTP found → INVALID
    expect(res.json().error.code).toBe('OTP_INVALID');
  });

  it('max attempts reached → OTP_MAX_ATTEMPTS', async () => {
    const prisma = getTestPrisma();
    const codeHash = await argon2.hash('424242', { type: argon2.argon2id });
    await prisma.otpRequest.create({
      data: {
        phoneE164: validArPhone,
        codeHash,
        expiresAt: new Date(Date.now() + 300_000),
        attempts: 5,
        maxAttempts: 5,
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-code',
      payload: { phone: validArPhone, code: '424242' },
    });
    expect(res.json().error.code).toBe('OTP_MAX_ATTEMPTS');
  });
});
