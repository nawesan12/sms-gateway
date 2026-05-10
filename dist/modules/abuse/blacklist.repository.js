export class BlacklistRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async isBlacklisted(type, value) {
        const now = new Date();
        return this.prisma.blacklist.findFirst({
            where: {
                type,
                value,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
        });
    }
    add(type, value, reason, expiresAt) {
        return this.prisma.blacklist.upsert({
            where: { type_value: { type, value } },
            update: { reason: reason ?? null, expiresAt: expiresAt ?? null },
            create: { type, value, reason: reason ?? null, expiresAt: expiresAt ?? null },
        });
    }
    remove(type, value) {
        return this.prisma.blacklist.deleteMany({ where: { type, value } });
    }
}
