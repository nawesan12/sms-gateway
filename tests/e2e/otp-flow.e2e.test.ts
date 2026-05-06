import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import nock from 'nock';
import argon2 from 'argon2';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '@/../tests/helpers/test-app.js';
import { disconnectTestPrisma, getTestPrisma, truncateAll } from '@/../tests/helpers/test-db.js';
import { createTestDevice, validArPhone } from '@/../tests/helpers/fixtures.js';
import { startSmsSendWorker } from '@/queue/workers/sms-send.worker.js';
import { loadEnv, resetEnvCache } from '@/config/env.js';

let app: FastifyInstance;
let workerHandle: { worker: Worker; shutdown: () => Promise<void> };

beforeAll(async () => {
  resetEnvCache();
  app = await createTestApp();
  const env = loadEnv();
  workerHandle = startSmsSendWorker(
    env,
    app.log.child({ component: 'e2e-worker' }) as never,
  ) as never;
});

afterAll(async () => {
  await workerHandle.shutdown();
  await app.close();
  await disconnectTestPrisma();

  // Drain residual queue keys
  const r = new IORedis(process.env.REDIS_URL!);
  const keys = await r.keys('bull:sms.send:*');
  if (keys.length > 0) await r.del(...keys);
  await r.quit();
});

beforeEach(async () => {
  nock.cleanAll();
  await truncateAll(getTestPrisma());
});

describe('OTP flow E2E', () => {
  it('send-code → worker → TextBee mock 200 → verify-code', async () => {
    const device = await createTestDevice(getTestPrisma(), { textbeeDeviceId: 'tb-e2e' });

    const tbScope = nock('https://api.textbee.dev')
      .post(`/api/v1/gateway/devices/tb-e2e/send-sms`)
      .reply(200, { data: { messageId: 'mid-e2e' } });

    const send = await app.inject({
      method: 'POST',
      url: '/v1/auth/send-code',
      payload: { phone: validArPhone },
    });
    expect(send.statusCode).toBe(200);

    // Wait for worker to process the job
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('worker timeout')), 15_000);
      const poll = setInterval(async () => {
        const sms = await getTestPrisma().smsMessage.findFirst({
          where: { recipientE164: validArPhone, status: 'SENT' },
        });
        if (sms) {
          clearInterval(poll);
          clearTimeout(timeout);
          resolve();
        }
      }, 250);
    });

    expect(tbScope.isDone()).toBe(true);

    // Now we don't know the plain code, so seed a known one to verify the verify path:
    // The job consumed the original code already in argon2 form. To exercise verify,
    // we replace the codeHash with a known value.
    const otp = await getTestPrisma().otpRequest.findFirst({ where: { phoneE164: validArPhone } });
    expect(otp).not.toBeNull();

    const knownHash = await argon2.hash('424242', { type: argon2.argon2id });
    await getTestPrisma().otpRequest.update({
      where: { id: otp!.id },
      data: { codeHash: knownHash, attempts: 0, consumedAt: null },
    });

    const verify = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-code',
      payload: { phone: validArPhone, code: '424242' },
    });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().data.accessToken).toBeTypeOf('string');

    const sms = await getTestPrisma().smsMessage.findFirst({
      where: { deviceId: device.id, status: 'SENT' },
    });
    expect(sms).not.toBeNull();
    expect(sms!.textbeeMessageId).toBe('mid-e2e');
  }, 30_000);
});
