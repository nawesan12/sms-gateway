import type { PrismaClient, User } from '@prisma/client';

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByPhone(phoneE164: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phoneE164 } });
  }

  upsertByPhone(phoneE164: string): Promise<User> {
    return this.prisma.user.upsert({
      where: { phoneE164 },
      update: { lastLoginAt: new Date() },
      create: { phoneE164, lastLoginAt: new Date() },
    });
  }
}
