import type { PrismaClient } from '@prisma/client';
import { DeviceCrypto } from '@/modules/devices/crypto.js';

export async function createTestDevice(
  prisma: PrismaClient,
  overrides: Partial<{
    name: string;
    textbeeDeviceId: string;
    apiKey: string;
    priority: number;
  }> = {},
) {
  const crypto = new DeviceCrypto(process.env.MASTER_ENCRYPTION_KEY_B64!);
  const apiKey = overrides.apiKey ?? 'test-api-key-1234567890';
  return prisma.device.create({
    data: {
      name: overrides.name ?? 'test-device',
      textbeeDeviceId: overrides.textbeeDeviceId ?? `tb-${Math.random().toString(36).slice(2, 8)}`,
      apiKeyEncrypted: crypto.encrypt(apiKey),
      priority: overrides.priority ?? 100,
    },
  });
}

export const validArPhone = '+5491150000001';
export const validArPhoneAlt = '+5491150000002';
