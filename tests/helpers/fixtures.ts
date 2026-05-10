import type { PrismaClient } from '@prisma/client';
import { hashApiKey } from '@/lib/api-key.js';

export async function createTestDevice(
  prisma: PrismaClient,
  overrides: Partial<{
    name: string;
    textbeeDeviceId: string;
    apiKey: string;
    priority: number;
    fcmToken: string;
  }> = {},
) {
  const apiKey = overrides.apiKey ?? 'test-api-key-1234567890';
  const apiKeyHash = hashApiKey(process.env.MASTER_ENCRYPTION_KEY_B64!, apiKey);
  return prisma.device.create({
    data: {
      name: overrides.name ?? 'test-device',
      textbeeDeviceId: overrides.textbeeDeviceId ?? `tb-${Math.random().toString(36).slice(2, 8)}`,
      apiKeyHash,
      fcmToken: overrides.fcmToken ?? 'test-fcm-token',
      priority: overrides.priority ?? 100,
    },
  });
}

export const validArPhone = '+5491150000001';
export const validArPhoneAlt = '+5491150000002';
