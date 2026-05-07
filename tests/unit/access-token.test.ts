import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { generateAccessToken, hashAccessToken } from '@/modules/auth/access-token.service.js';

describe('access-token helpers', () => {
  it('hashAccessToken devuelve sha256 hex determinista', () => {
    const token = 'super-secret-token';
    const expected = crypto.createHash('sha256').update(token).digest('hex');
    expect(hashAccessToken(token)).toBe(expected);
    expect(hashAccessToken(token)).toBe(hashAccessToken(token));
  });

  it('hashAccessToken cambia con tokens distintos', () => {
    expect(hashAccessToken('a')).not.toBe(hashAccessToken('b'));
  });

  it('generateAccessToken produce 256 bits base64url únicos', () => {
    const a = generateAccessToken();
    const b = generateAccessToken();
    expect(a).not.toBe(b);
    // base64url de 32 bytes = 43 chars sin padding
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
