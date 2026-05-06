import { describe, it, expect } from 'vitest';
import argon2 from 'argon2';
import { OtpService } from '@/modules/otp/otp.service.js';

const fakeLogger = { warn() {}, info() {}, error() {}, debug() {} } as never;

const env = {
  OTP_LENGTH: 6,
  OTP_TTL_SEC: 300,
  OTP_MAX_ATTEMPTS: 5,
  OTP_MESSAGE_TEMPLATE: 'Codigo {{code}} expira en {{minutes}}m',
  RATE_LIMIT_PHONE_COOLDOWN_SEC: 60,
} as never;

describe('OtpService.hash & verify', () => {
  const svc = new OtpService({} as never, env, fakeLogger);

  it('hashea y verifica correctamente', async () => {
    const hash = await svc.hash('123456');
    expect(await svc.verifyHash(hash, '123456')).toBe(true);
    expect(await svc.verifyHash(hash, '654321')).toBe(false);
  });

  it('hash es argon2id', async () => {
    const hash = await svc.hash('111222');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await argon2.verify(hash, '111222')).toBe(true);
  });
});

describe('OtpService.buildMessage', () => {
  const svc = new OtpService({} as never, env, fakeLogger);

  it('reemplaza placeholders', () => {
    const msg = svc.buildMessage('424242');
    expect(msg).toContain('424242');
    expect(msg).toMatch(/expira en \d+m/);
  });
});
