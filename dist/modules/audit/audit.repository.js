export class AuditRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    log(data) {
        return this.prisma.auditLog.create({ data }).then(() => undefined);
    }
}
