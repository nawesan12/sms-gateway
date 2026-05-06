import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { DeviceCrypto } from '@/modules/devices/crypto.js';

const key = randomBytes(32).toString('base64');

describe('DeviceCrypto', () => {
  const c = new DeviceCrypto(key);

  it('encrypts y decrypts roundtrip', () => {
    const pt = 'super-secret-textbee-api-key-1234567890';
    const ct = c.encrypt(pt);
    expect(ct).not.toEqual(pt);
    expect(c.decrypt(ct)).toEqual(pt);
  });

  it('rechaza claves de tamano incorrecto', () => {
    expect(() => new DeviceCrypto(Buffer.alloc(16).toString('base64'))).toThrow();
  });

  it('falla al desencriptar payload manipulado', () => {
    const ct = c.encrypt('hello');
    const tampered = Buffer.from(ct, 'base64');
    const last = tampered.length - 1;
    tampered.writeUInt8(tampered.readUInt8(last) ^ 0xff, last);
    expect(() => c.decrypt(tampered.toString('base64'))).toThrow();
  });
});
