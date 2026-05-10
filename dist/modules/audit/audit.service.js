import { AuditRepository } from './audit.repository.js';
export class AuditService {
    logger;
    repo;
    constructor(prisma, logger) {
        this.logger = logger;
        this.repo = new AuditRepository(prisma);
    }
    async record(event) {
        try {
            await this.repo.log({
                eventType: event.eventType,
                actorType: event.actorType,
                actorId: event.actorId ?? null,
                targetType: event.targetType ?? null,
                targetId: event.targetId ?? null,
                metadata: (event.metadata ?? null),
                ipAddress: event.ipAddress ?? null,
                correlationId: event.correlationId ?? null,
            });
        }
        catch (err) {
            this.logger.error({ err, event: event.eventType }, 'audit log failed');
        }
    }
}
