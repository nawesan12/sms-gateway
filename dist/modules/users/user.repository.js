export class UserRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findByPhone(phoneE164) {
        return this.prisma.user.findUnique({ where: { phoneE164 } });
    }
    upsertByPhone(phoneE164) {
        return this.prisma.user.upsert({
            where: { phoneE164 },
            update: { lastLoginAt: new Date() },
            create: { phoneE164, lastLoginAt: new Date() },
        });
    }
}
