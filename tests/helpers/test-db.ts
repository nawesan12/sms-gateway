import { PrismaClient } from '@prisma/client';

let prismaSingleton: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient();
  }
  return prismaSingleton;
}

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.job.deleteMany(),
    prisma.smsMessage.deleteMany(),
    prisma.otpRequest.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.blacklist.deleteMany(),
    prisma.campaignDelivery.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.contactListMember.deleteMany(),
    prisma.contactList.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.device.deleteMany(),
    prisma.tokenTransaction.deleteMany(),
    prisma.tokenBalance.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function disconnectTestPrisma(): Promise<void> {
  if (prismaSingleton) {
    await prismaSingleton.$disconnect();
    prismaSingleton = null;
  }
}
