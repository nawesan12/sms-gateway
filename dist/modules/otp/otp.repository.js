export class OtpRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(data) {
        return this.prisma.otpRequest.create({ data });
    }
    findActiveByPhone(phoneE164, ref = new Date()) {
        return this.prisma.otpRequest.findFirst({
            where: {
                phoneE164,
                consumedAt: null,
                expiresAt: { gt: ref },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    countSince(phoneE164, since) {
        return this.prisma.otpRequest.count({
            where: { phoneE164, createdAt: { gte: since } },
        });
    }
    incrementAttempts(id) {
        return this.prisma.otpRequest.update({
            where: { id },
            data: { attempts: { increment: 1 } },
        });
    }
    consume(id) {
        return this.prisma.otpRequest.update({
            where: { id },
            data: { consumedAt: new Date() },
        });
    }
}
