import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import nock from 'nock';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '@/../tests/helpers/test-app.js';
import { disconnectTestPrisma, getTestPrisma, truncateAll } from '@/../tests/helpers/test-db.js';
import { createTestDevice, validArPhone } from '@/../tests/helpers/fixtures.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await disconnectTestPrisma();
});

beforeEach(async () => {
  nock.cleanAll();
  await truncateAll(getTestPrisma());
});

describe('POST /v1/auth/send-code', () => {
  it('rechaza phone invalido', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/send-code',
      payload: { phone: 'abc' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_PHONE');
  });

  it('encola job para phone valido si hay device activo', async () => {
    await createTestDevice(getTestPrisma());
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/send-code',
      payload: { phone: validArPhone },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.requestId).toBeDefined();
    expect(body.data.expiresInSec).toBeGreaterThan(0);
    expect(body.data.phoneMasked).toContain('*');

    const otp = await getTestPrisma().otpRequest.findFirst({ where: { phoneE164: validArPhone } });
    expect(otp).not.toBeNull();
    expect(otp!.codeHash.startsWith('$argon2id$')).toBe(true);
  });

  it('aplica cooldown 60s', async () => {
    await createTestDevice(getTestPrisma());
    const r1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/send-code',
      payload: { phone: validArPhone },
    });
    expect(r1.statusCode).toBe(200);

    const r2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/send-code',
      payload: { phone: validArPhone },
    });
    expect(r2.statusCode).toBe(429);
    expect(r2.json().error.code).toBe('COOLDOWN_ACTIVE');
  });
});
