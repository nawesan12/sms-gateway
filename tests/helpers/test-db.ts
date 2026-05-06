import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';

let prismaSingleton: PrismaClient | null = null;
let redisSingleton: IORedis | null = null;

export function getTestPrisma(): PrismaClient {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient();
  }
  return prismaSingleton;
}

export function getTestRedis(): IORedis {
  if (!redisSingleton) {
    redisSingleton = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
  }
  return redisSingleton;
}

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.smsMessage.deleteMany(),
    prisma.otpRequest.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.blacklist.deleteMany(),
    prisma.device.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  // Flush rate-limit + queue keys
  const r = getTestRedis();
  await r.flushdb();
}

export async function disconnectTestPrisma(): Promise<void> {
  if (prismaSingleton) {
    await prismaSingleton.$disconnect();
    prismaSingleton = null;
  }
  if (redisSingleton) {
    await redisSingleton.quit().catch(() => undefined);
    redisSingleton = null;
  }
}
