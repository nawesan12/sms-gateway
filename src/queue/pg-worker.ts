import { randomUUID } from 'node:crypto';
import { JobStatus, type PrismaClient } from '@prisma/client';
import type { AppLogger } from '@/lib/logger-types.js';

export interface PgWorkerOptions<T> {
  // ms entre polls cuando no hay trabajo. Default 500.
  pollIntervalMs?: number;
  // Concurrencia: cuántos jobs procesar en paralelo. Default 1.
  concurrency?: number;
  // Backoff exponencial base. delay = backoffMs * 2^(attempts-1). Default 2000.
  backoffMs?: number;
  // Rate limiter opcional: máximo N jobs por `durationMs`.
  limiter?: { max: number; durationMs: number };
  // Hook que corre cuando un job agota retries y queda DEAD. Equivalente al
  // worker.on('failed') de BullMQ cuando era el último intento.
  onPermanentFailure?: (
    job: { id: string; data: T; attempts: number },
    err: Error,
  ) => Promise<void>;
}

export type PgWorkerHandler<T> = (job: { id: string; data: T; attempts: number }) => Promise<void>;

interface ClaimedJob {
  id: string;
  queue: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}

// Worker que polea la tabla `jobs` y ejecuta handlers. Usa SKIP LOCKED para que,
// si en el futuro corremos múltiples procesos, no se duplique trabajo.
export class PgWorker<T extends object = Record<string, unknown>> {
  private readonly id = randomUUID();
  private readonly pollIntervalMs: number;
  private readonly concurrency: number;
  private readonly backoffMs: number;
  private readonly limiter?: { max: number; durationMs: number };
  private readonly onPermanentFailure?: PgWorkerOptions<T>['onPermanentFailure'];
  private inFlight = 0;
  private stopping = false;
  private loopHandle: NodeJS.Timeout | null = null;
  // Para rate limiting: timestamps de los últimos N comienzos de job.
  private recentStarts: number[] = [];

  constructor(
    private readonly prisma: PrismaClient,
    private readonly queueName: string,
    private readonly handler: PgWorkerHandler<T>,
    private readonly logger: AppLogger,
    opts: PgWorkerOptions<T> = {},
  ) {
    this.pollIntervalMs = opts.pollIntervalMs ?? 500;
    this.concurrency = Math.max(1, opts.concurrency ?? 1);
    this.backoffMs = opts.backoffMs ?? 2000;
    this.limiter = opts.limiter;
    this.onPermanentFailure = opts.onPermanentFailure;
  }

  start(): void {
    if (this.loopHandle) return;
    this.loopHandle = setInterval(() => void this.tick(), this.pollIntervalMs);
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.loopHandle) {
      clearInterval(this.loopHandle);
      this.loopHandle = null;
    }
    // Esperar a que los in-flight terminen (con timeout).
    const start = Date.now();
    while (this.inFlight > 0 && Date.now() - start < 10_000) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  private async tick(): Promise<void> {
    if (this.stopping) return;
    while (this.inFlight < this.concurrency) {
      if (!this.limiterAllow()) return;

      const job = await this.claimOne();
      if (!job) return;

      this.inFlight += 1;
      this.recordStart();
      void this.runJob(job).finally(() => {
        this.inFlight -= 1;
      });
    }
  }

  private limiterAllow(): boolean {
    if (!this.limiter) return true;
    const now = Date.now();
    const cutoff = now - this.limiter.durationMs;
    this.recentStarts = this.recentStarts.filter((t) => t > cutoff);
    return this.recentStarts.length < this.limiter.max;
  }

  private recordStart(): void {
    if (!this.limiter) return;
    this.recentStarts.push(Date.now());
  }

  private async claimOne(): Promise<ClaimedJob | null> {
    // Atomic claim via raw SQL: UPDATE…WHERE id = (SELECT…FOR UPDATE SKIP LOCKED LIMIT 1)
    // Volvemos a id+payload+attempts del row tomado.
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        queue: string;
        payload: unknown;
        attempts: number;
        max_attempts: number;
      }>
    >`
      UPDATE "jobs"
      SET status = 'RUNNING'::"JobStatus",
          "lockedAt" = NOW(),
          "lockedBy" = ${this.id},
          attempts = attempts + 1,
          "updatedAt" = NOW()
      WHERE id = (
        SELECT id FROM "jobs"
        WHERE queue = ${this.queueName}
          AND status = 'PENDING'::"JobStatus"
          AND "nextRunAt" <= NOW()
        ORDER BY "nextRunAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, queue, payload, attempts, "maxAttempts" AS max_attempts
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      queue: row.queue,
      payload: row.payload,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
    };
  }

  private async runJob(job: ClaimedJob): Promise<void> {
    const log = this.logger.child({ jobId: job.id, queue: job.queue, attempt: job.attempts });
    try {
      await this.handler({ id: job.id, data: job.payload as T, attempts: job.attempts });
      await this.prisma.job.update({
        where: { id: job.id },
        data: { status: JobStatus.COMPLETED, lockedAt: null, lockedBy: null, lastError: null },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isLast = job.attempts >= job.maxAttempts;
      if (isLast) {
        log.error({ err }, 'job exhausted retries → DEAD');
        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.DEAD,
            lockedAt: null,
            lockedBy: null,
            lastError: message.slice(0, 1000),
          },
        });
        if (this.onPermanentFailure) {
          try {
            await this.onPermanentFailure(
              { id: job.id, data: job.payload as T, attempts: job.attempts },
              err instanceof Error ? err : new Error(message),
            );
          } catch (hookErr) {
            log.error({ err: hookErr }, 'onPermanentFailure hook crashed');
          }
        }
      } else {
        const delayMs = this.backoffMs * Math.pow(2, job.attempts - 1);
        log.warn({ err, delayMs }, 'job failed, will retry');
        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.PENDING,
            lockedAt: null,
            lockedBy: null,
            lastError: message.slice(0, 1000),
            nextRunAt: new Date(Date.now() + delayMs),
          },
        });
      }
    }
  }
}

// Cleanup de jobs viejos. Mantenemos 1h los completados y 7 días los dead.
export async function purgeOldJobs(prisma: PrismaClient): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.job.deleteMany({
    where: { status: JobStatus.COMPLETED, updatedAt: { lt: oneHourAgo } },
  });
  await prisma.job.deleteMany({
    where: { status: JobStatus.DEAD, updatedAt: { lt: sevenDaysAgo } },
  });
}
