export class ContactsRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findById(id) {
        return this.prisma.contact.findUnique({ where: { id } });
    }
    findByPhone(phoneE164) {
        return this.prisma.contact.findUnique({ where: { phoneE164 } });
    }
    create(data) {
        return this.prisma.contact.create({ data });
    }
    upsertByPhone(data) {
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
    delete(id) {
        return this.prisma.contact.delete({ where: { id } });
    }
    list(args) {
        const where = args.search
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
