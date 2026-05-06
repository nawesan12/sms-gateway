import { SmsStatus, type Prisma, type PrismaClient, type SmsMessage } from '@prisma/client';

export class SmsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: Prisma.SmsMessageUncheckedCreateInput): Promise<SmsMessage> {
    return this.prisma.smsMessage.create({ data });
  }

  markSent(id: string, providerMessageId?: string): Promise<SmsMessage> {
    return this.prisma.smsMessage.update({
      where: { id },
      data: {
        status: SmsStatus.SENT,
        sentAt: new Date(),
        textbeeMessageId: providerMessageId ?? null,
      },
    });
  }

  markFailed(id: string, errorCode: string, errorMessage: string): Promise<SmsMessage> {
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

  bumpRetry(id: string): Promise<SmsMessage> {
    return this.prisma.smsMessage.update({
      where: { id },
      data: { retryCount: { increment: 1 }, status: SmsStatus.RETRYING },
    });
  }

  list(args: {
    status?: SmsStatus;
    deviceId?: string;
    from?: Date;
    to?: Date;
    skip: number;
    take: number;
  }): Promise<SmsMessage[]> {
    return this.prisma.smsMessage.findMany({
      where: {
        ...(args.status ? { status: args.status } : {}),
        ...(args.deviceId ? { deviceId: args.deviceId } : {}),
        ...(args.from || args.to
          ? { createdAt: { ...(args.from ? { gte: args.from } : {}), ...(args.to ? { lte: args.to } : {}) } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: args.skip,
      take: args.take,
    });
  }

  count(args: { status?: SmsStatus; from?: Date; to?: Date }): Promise<number> {
    return this.prisma.smsMessage.count({
      where: {
        ...(args.status ? { status: args.status } : {}),
        ...(args.from || args.to
          ? { createdAt: { ...(args.from ? { gte: args.from } : {}), ...(args.to ? { lte: args.to } : {}) } }
          : {}),
      },
    });
  }
}
