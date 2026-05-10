import { SmsStatus } from '@prisma/client';
export class SmsRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(data) {
        return this.prisma.smsMessage.create({ data });
    }
    markSent(id, providerMessageId) {
        return this.prisma.smsMessage.update({
            where: { id },
            data: {
                status: SmsStatus.SENT,
                sentAt: new Date(),
                textbeeMessageId: providerMessageId ?? null,
            },
        });
    }
    markFailed(id, errorCode, errorMessage) {
        return this.prisma.smsMessage.update({
            where: { id },
            data: {
                status: SmsStatus.FAILED,
                failedAt: new Date(),
                errorCode,
                errorMessage,
            },
        });
    }
    bumpRetry(id) {
        return this.prisma.smsMessage.update({
            where: { id },
            data: { retryCount: { increment: 1 }, status: SmsStatus.RETRYING },
        });
    }
    list(args) {
        return this.prisma.smsMessage.findMany({
            where: {
                ...(args.status ? { status: args.status } : {}),
                ...(args.deviceId ? { deviceId: args.deviceId } : {}),
                ...(args.from || args.to
                    ? {
                        createdAt: {
                            ...(args.from ? { gte: args.from } : {}),
                            ...(args.to ? { lte: args.to } : {}),
                        },
                    }
                    : {}),
            },
            orderBy: { createdAt: 'desc' },
            skip: args.skip,
            take: args.take,
        });
    }
    count(args) {
        return this.prisma.smsMessage.count({
            where: {
                ...(args.status ? { status: args.status } : {}),
                ...(args.from || args.to
                    ? {
                        createdAt: {
                            ...(args.from ? { gte: args.from } : {}),
                            ...(args.to ? { lte: args.to } : {}),
                        },
                    }
                    : {}),
            },
        });
    }
}
