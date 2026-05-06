import type { Prisma, PrismaClient } from '@prisma/client';

export class AuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  log(data: Prisma.AuditLogUncheckedCreateInput): Promise<void> {
    return this.prisma.auditLog.create({ data }).then(() => undefined);
  }
}
