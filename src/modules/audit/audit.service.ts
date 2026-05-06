import type { PrismaClient } from '@prisma/client';
import type { AppLogger } from '@/lib/logger-types.js';
import { AuditRepository } from './audit.repository.js';

export interface AuditEvent {
  eventType: string;
  actorType: 'user' | 'admin' | 'system';
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  correlationId?: string | null;
}

export class AuditService {
  private readonly repo: AuditRepository;

  constructor(prisma: PrismaClient, private readonly logger: AppLogger) {
    this.repo = new AuditRepository(prisma);
  }

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.repo.log({
        eventType: event.eventType,
        actorType: event.actorType,
        actorId: event.actorId ?? null,
        targetType: event.targetType ?? null,
        targetId: event.targetId ?? null,
        metadata: (event.metadata ?? null) as never,
        ipAddress: event.ipAddress ?? null,
        correlationId: event.correlationId ?? null,
      });
    } catch (err) {
      this.logger.error({ err, event: event.eventType }, 'audit log failed');
    }
  }
}
