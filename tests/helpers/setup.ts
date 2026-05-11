import { generateKeyPairSync, randomBytes } from 'node:crypto';

if (!process.env.JWT_PRIVATE_KEY_B64 || !process.env.JWT_PUBLIC_KEY_B64) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.JWT_PRIVATE_KEY_B64 = Buffer.from(
    privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
  ).toString('base64');
  process.env.JWT_PUBLIC_KEY_B64 = Buffer.from(
    publicKey.export({ type: 'spki', format: 'pem' }) as string,
  ).toString('base64');
}

if (!process.env.MASTER_ENCRYPTION_KEY_B64) {
  process.env.MASTER_ENCRYPTION_KEY_B64 = randomBytes(32).toString('base64');
}

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://test:test@localhost:55432/sms_gateway_test?schema=public';
process.env.ADMIN_BOOTSTRAP_TOKEN = process.env.ADMIN_BOOTSTRAP_TOKEN ?? 'test-bootstrap-token';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? '';
