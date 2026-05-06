import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

export class DeviceCrypto {
  private readonly key: Buffer;

  constructor(masterKeyB64: string) {
    const buf = Buffer.from(masterKeyB64, 'base64');
    if (buf.length !== 32) {
      throw new Error('Master key must be 32 bytes (base64-encoded)');
    }
    this.key = buf;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALG, this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ct]).toString('base64');
  }

  decrypt(payloadB64: string): string {
    const payload = Buffer.from(payloadB64, 'base64');
    if (payload.length < IV_LEN + TAG_LEN + 1) {
      throw new Error('Ciphertext too short');
    }
    const iv = payload.subarray(0, IV_LEN);
    const tag = payload.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = payload.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALG, this.key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  }
}
