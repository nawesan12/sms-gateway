import { BlacklistType, type Blacklist, type PrismaClient } from '@prisma/client';

export class BlacklistRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async isBlacklisted(type: BlacklistType, value: string): Promise<Blacklist | null> {
    const now = new Date();
    return this.prisma.blacklist.findFirst({
      where: {
        type,
        value,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
  }

  add(type: BlacklistType, value: string, reason?: string, expiresAt?: Date): Promise<Blacklist> {
    return this.prisma.blacklist.upsert({
      where: { type_value: { type, value } },
      update: { reason: reason ?? null, expiresAt: expiresAt ?? null },
      create: { type, value, reason: reason ?? null, expiresAt: expiresAt ?? null },
    });
  }

  remove(type: BlacklistType, value: string): Promise<{ count: number }> {
    return this.prisma.blacklist.deleteMany({ where: { type, value } });
  }
}
