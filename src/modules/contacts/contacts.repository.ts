import type { Contact, Prisma, PrismaClient } from '@prisma/client';

export class ContactsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<Contact | null> {
    return this.prisma.contact.findUnique({ where: { id } });
  }

  findByPhone(phoneE164: string): Promise<Contact | null> {
    return this.prisma.contact.findUnique({ where: { phoneE164 } });
  }

  create(data: Prisma.ContactUncheckedCreateInput): Promise<Contact> {
    return this.prisma.contact.create({ data });
  }

  upsertByPhone(data: {
    phoneE164: string;
    name?: string | null;
    email?: string | null;
  }): Promise<{ contact: Contact; created: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.contact.findUnique({ where: { phoneE164: data.phoneE164 } });
      if (existing) {
        const updated = await tx.contact.update({
          where: { id: existing.id },
          data: {
            name: data.name ?? existing.name,
            email: data.email ?? existing.email,
          },
        });
        return { contact: updated, created: false };
      }
      const created = await tx.contact.create({
        data: {
          phoneE164: data.phoneE164,
          name: data.name ?? null,
          email: data.email ?? null,
        },
      });
      return { contact: created, created: true };
    });
  }

  async *bulkUpsertByPhone(
    items: Array<{
      phoneE164: string;
      name: string | null;
      email: string | null;
      sourceRow: number;
    }>,
    chunkSize = 500,
  ): AsyncGenerator<{
    processed: number;
    created: number;
    updated: number;
    failed: Array<{ row: number; phone: string; reason: string }>;
  }> {
    for (let start = 0; start < items.length; start += chunkSize) {
      const chunk = items.slice(start, start + chunkSize);
      const phones = chunk.map((c) => c.phoneE164);
      const failed: Array<{ row: number; phone: string; reason: string }> = [];

      const existing = await this.prisma.contact.findMany({
        where: { phoneE164: { in: phones } },
        select: { id: true, phoneE164: true, name: true, email: true },
      });
      const existingMap = new Map(existing.map((e) => [e.phoneE164, e]));

      const toCreate = chunk.filter((c) => !existingMap.has(c.phoneE164));
      let created = 0;
      if (toCreate.length > 0) {
        try {
          const res = await this.prisma.contact.createMany({
            data: toCreate.map((c) => ({
              phoneE164: c.phoneE164,
              name: c.name,
              email: c.email,
            })),
            skipDuplicates: true,
          });
          created = res.count;
        } catch (err) {
          for (const c of toCreate) {
            failed.push({
              row: c.sourceRow,
              phone: c.phoneE164,
              reason: (err as Error).message.slice(0, 120),
            });
          }
        }
      }

      let updated = 0;
      const toUpdate = chunk.filter((c) => existingMap.has(c.phoneE164));
      for (const c of toUpdate) {
        const prev = existingMap.get(c.phoneE164)!;
        const newName = c.name ?? prev.name;
        const newEmail = c.email ?? prev.email;
        if (newName === prev.name && newEmail === prev.email) {
          updated++;
          continue;
        }
        try {
          await this.prisma.contact.update({
            where: { id: prev.id },
            data: { name: newName, email: newEmail },
          });
          updated++;
        } catch (err) {
          failed.push({
            row: c.sourceRow,
            phone: c.phoneE164,
            reason: (err as Error).message.slice(0, 120),
          });
        }
      }

      yield { processed: chunk.length, created, updated, failed };
    }
  }

  delete(id: string): Promise<Contact> {
    return this.prisma.contact.delete({ where: { id } });
  }

  countDeliveries(contactId: string): Promise<number> {
    return this.prisma.campaignDelivery.count({ where: { contactId } });
  }

  list(args: {
    search?: string;
    skip: number;
    take: number;
  }): Promise<{ items: Contact[]; total: number }> {
    const where: Prisma.ContactWhereInput = args.search
      ? {
          OR: [
            { phoneE164: { contains: args.search } },
            { name: { contains: args.search, mode: 'insensitive' } },
            { email: { contains: args.search, mode: 'insensitive' } },
          ],
        }
      : {};
    return Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: args.skip,
        take: args.take,
      }),
      this.prisma.contact.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  }
}
