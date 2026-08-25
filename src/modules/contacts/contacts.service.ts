import type { Contact, PrismaClient } from '@prisma/client';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';
import { validateAndNormalizePhone } from '@/lib/phone.js';
import { parseCsv } from '@/lib/csv-parser.js';
import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';
import { ContactsRepository } from './contacts.repository.js';

export interface CreateContactInput {
  phone: string;
  name?: string | null;
  email?: string | null;
}

export interface ImportError {
  row: number;
  phone: string;
  reason: string;
}

export interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
}

export type ImportEvent =
  | { phase: 'parsing' }
  | { phase: 'validated'; total: number; valid: number; invalid: number }
  | {
      phase: 'progress';
      processed: number;
      total: number;
      imported: number;
      updated: number;
      skipped: number;
    }
  | { phase: 'done'; summary: ImportSummary }
  | { phase: 'error'; message: string };

const MAX_ROWS = 100_000;
const CHUNK_SIZE = 500;

export class ContactsService {
  private readonly repo: ContactsRepository;

  constructor(
    prisma: PrismaClient,
    private readonly env: AppEnv,
    private readonly logger: AppLogger,
  ) {
    this.repo = new ContactsRepository(prisma);
  }

  async create(input: CreateContactInput): Promise<Contact> {
    const v = validateAndNormalizePhone(input.phone, this.env.DEFAULT_PHONE_REGION);
    if (!v.valid) {
      throw new AppError(ERROR_CODES.INVALID_PHONE, 'Invalid phone', 400);
    }
    const existing = await this.repo.findByPhone(v.e164);
    if (existing) {
      throw new AppError(ERROR_CODES.VALIDATION, 'Contact with this phone already exists', 409);
    }
    return this.repo.create({
      phoneE164: v.e164,
      name: input.name ?? null,
      email: input.email ?? null,
    });
  }

  list(args: { search?: string; page: number; pageSize: number }) {
    return this.repo
      .list({ search: args.search, skip: (args.page - 1) * args.pageSize, take: args.pageSize })
      .then(({ items, total }) => ({ items, total, page: args.page, pageSize: args.pageSize }));
  }

  async getById(id: string): Promise<Contact> {
    const c = await this.repo.findById(id);
    if (!c) throw new AppError(ERROR_CODES.NOT_FOUND, 'Contact not found', 404);
    return c;
  }

  async bulkCreate(phones: string[], defaultName?: string): Promise<ImportSummary> {
    const summary: ImportSummary = { imported: 0, updated: 0, skipped: 0, errors: [] };
    const valid: Array<{
      phoneE164: string;
      name: string | null;
      email: string | null;
      sourceRow: number;
    }> = [];

    for (let i = 0; i < phones.length; i++) {
      const raw = (phones[i] ?? '').trim();
      const sourceRow = i + 1;
      if (!raw) {
        summary.errors.push({ row: sourceRow, phone: '', reason: 'empty phone' });
        summary.skipped++;
        continue;
      }
      const v = validateAndNormalizePhone(raw, this.env.DEFAULT_PHONE_REGION);
      if (!v.valid) {
        summary.errors.push({ row: sourceRow, phone: raw, reason: v.reason });
        summary.skipped++;
        continue;
      }
      valid.push({
        phoneE164: v.e164,
        name: defaultName?.trim() || null,
        email: null,
        sourceRow,
      });
    }

    // Dedup por phoneE164 — si el usuario pega el mismo número dos veces,
    // se queda con el último (mismo criterio que el import CSV).
    const dedup = new Map<string, (typeof valid)[number]>();
    for (const v of valid) dedup.set(v.phoneE164, v);
    const unique = [...dedup.values()];

    for await (const chunk of this.repo.bulkUpsertByPhone(unique, CHUNK_SIZE)) {
      summary.imported += chunk.created;
      summary.updated += chunk.updated;
      for (const f of chunk.failed) {
        summary.errors.push(f);
        summary.skipped++;
      }
    }
    return summary;
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.repo.delete(id);
  }

  async *importCsv(csv: string, signal?: AbortSignal): AsyncGenerator<ImportEvent> {
    const summary: ImportSummary = { imported: 0, updated: 0, skipped: 0, errors: [] };

    yield { phase: 'parsing' };

    let rows: ReturnType<typeof parseCsv>;
    try {
      rows = parseCsv(csv, { maxRows: MAX_ROWS });
    } catch (err) {
      yield { phase: 'error', message: `CSV parse error: ${(err as Error).message}` };
      return;
    }

    if (rows.length === 0) {
      yield { phase: 'done', summary };
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(rows[0]!, 'phone')) {
      yield { phase: 'error', message: 'CSV must contain a "phone" column' };
      return;
    }

    const valid: Array<{
      phoneE164: string;
      name: string | null;
      email: string | null;
      sourceRow: number;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const sourceRow = i + 2;
      const phoneRaw = (row['phone'] ?? '').trim();
      if (!phoneRaw) {
        summary.errors.push({ row: sourceRow, phone: '', reason: 'empty phone' });
        summary.skipped++;
        continue;
      }
      const v = validateAndNormalizePhone(phoneRaw, this.env.DEFAULT_PHONE_REGION);
      if (!v.valid) {
        summary.errors.push({ row: sourceRow, phone: phoneRaw, reason: v.reason });
        summary.skipped++;
        continue;
      }
      valid.push({
        phoneE164: v.e164,
        name: row['name']?.trim() || null,
        email: row['email']?.trim() || null,
        sourceRow,
      });
    }

    yield {
      phase: 'validated',
      total: rows.length,
      valid: valid.length,
      invalid: summary.skipped,
    };

    const dedup = new Map<string, (typeof valid)[number]>();
    const seenRows = new Map<string, number[]>();
    for (const v of valid) {
      const rows = seenRows.get(v.phoneE164) ?? [];
      rows.push(v.sourceRow);
      seenRows.set(v.phoneE164, rows);
      dedup.set(v.phoneE164, v);
    }
    const unique = [...dedup.values()];
    for (const [phone, rows] of seenRows) {
      if (rows.length > 1) {
        const winner = rows[rows.length - 1]!;
        for (const r of rows) {
          if (r === winner) continue;
          summary.errors.push({
            row: r,
            phone,
            reason: `duplicate in csv (kept row ${winner})`,
          });
          summary.skipped++;
        }
      }
    }

    const total = unique.length;
    let processed = 0;

    for await (const chunk of this.repo.bulkUpsertByPhone(unique, CHUNK_SIZE)) {
      if (signal?.aborted) {
        this.logger.warn({ processed, total }, 'csv import aborted by client disconnect');
        break;
      }
      summary.imported += chunk.created;
      summary.updated += chunk.updated;
      for (const f of chunk.failed) {
        summary.errors.push(f);
        summary.skipped++;
      }
      processed += chunk.processed;
      yield {
        phase: 'progress',
        processed,
        total,
        imported: summary.imported,
        updated: summary.updated,
        skipped: summary.skipped,
      };
      await new Promise((resolve) => setImmediate(resolve));
    }

    yield { phase: 'done', summary };
  }
}
