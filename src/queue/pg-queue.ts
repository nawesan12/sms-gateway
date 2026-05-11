import type { PrismaClient, Prisma } from '@prisma/client';

export interface AddJobOptions {
  // Cuánto esperar antes de poder ejecutar el job por primera vez (ms).
  delayMs?: number;
  // Máximo de intentos (incluye el primero). Default: 4.
  maxAttempts?: number;
}

export interface AddBulkItem<T> {
  data: T;
  opts?: AddJobOptions;
}

// Cola persistida en Postgres. Reemplazo minimalista de `BullMQ.Queue`:
// `add()` / `addBulk()` solo insertan filas; el worker (PgWorker) las consume
// con FOR UPDATE SKIP LOCKED.
export class PgQueue<T extends object = Record<string, unknown>> {
  constructor(
    private readonly prisma: PrismaClient,
    public readonly name: string,
  ) {}

  async add(data: T, opts: AddJobOptions = {}): Promise<{ id: string }> {
    const job = await this.prisma.job.create({
      data: {
        queue: this.name,
        payload: data as unknown as Prisma.InputJsonValue,
        maxAttempts: opts.maxAttempts ?? 4,
        nextRunAt: new Date(Date.now() + (opts.delayMs ?? 0)),
      },
      select: { id: true },
    });
    return job;
  }

  async addBulk(items: AddBulkItem<T>[]): Promise<{ count: number }> {
    if (items.length === 0) return { count: 0 };
    const now = Date.now();
    const result = await this.prisma.job.createMany({
      data: items.map((it) => ({
        queue: this.name,
        payload: it.data as unknown as Prisma.InputJsonValue,
        maxAttempts: it.opts?.maxAttempts ?? 4,
        nextRunAt: new Date(now + (it.opts?.delayMs ?? 0)),
      })),
    });
    return { count: result.count };
  }

  // addBulk dentro de una transacción Prisma — útil para que campaigns.launch
  // pueda meter createMany(deliveries) + update(campaign) + addBulk(jobs) en
  // un solo $transaction y obtener atomicidad real.
  async addBulkTx(
    tx: Prisma.TransactionClient,
    items: AddBulkItem<T>[],
  ): Promise<{ count: number }> {
    if (items.length === 0) return { count: 0 };
    const now = Date.now();
    const result = await tx.job.createMany({
      data: items.map((it) => ({
        queue: this.name,
        payload: it.data as unknown as Prisma.InputJsonValue,
        maxAttempts: it.opts?.maxAttempts ?? 4,
        nextRunAt: new Date(now + (it.opts?.delayMs ?? 0)),
      })),
    });
    return { count: result.count };
  }

  async pendingCount(): Promise<number> {
    return this.prisma.job.count({ where: { queue: this.name, status: 'PENDING' } });
  }
}
