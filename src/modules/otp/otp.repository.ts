import type { OtpRequest, Prisma, PrismaClient } from '@prisma/client';

export class OtpRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: Prisma.OtpRequestUncheckedCreateInput): Promise<OtpRequest> {
    return this.prisma.otpRequest.create({ data });
  }

  findActiveByPhone(phoneE164: string, ref: Date = new Date()): Promise<OtpRequest | null> {
    return this.prisma.otpRequest.findFirst({
      where: {
        phoneE164,
        consumedAt: null,
        expiresAt: { gt: ref },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  countSince(phoneE164: string, since: Date): Promise<number> {
    return this.prisma.otpRequest.count({
      where: { phoneE164, createdAt: { gte: since } },
    });
  }

  incrementAttempts(id: string): Promise<OtpRequest> {
    return this.prisma.otpRequest.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  consume(id: string): Promise<OtpRequest> {
    return this.prisma.otpRequest.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }
}
