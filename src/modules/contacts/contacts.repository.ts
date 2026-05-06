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
    return this.prisma
      .$transaction(async (tx) => {
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

  delete(id: string): Promise<Contact> {
    return this.prisma.contact.delete({ where: { id } });
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
