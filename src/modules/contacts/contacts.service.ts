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

export interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; phone: string; reason: string }[];
}

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

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.repo.delete(id);
  }

  async importCsv(csv: string): Promise<ImportSummary> {
    const summary: ImportSummary = { imported: 0, updated: 0, skipped: 0, errors: [] };
    let rows: ReturnType<typeof parseCsv>;
    try {
      rows = parseCsv(csv, { maxRows: 10_000 });
    } catch (err) {
      throw new AppError(ERROR_CODES.VALIDATION, `CSV parse error: ${(err as Error).message}`, 400);
    }
    if (rows.length === 0) return summary;
    if (!Object.prototype.hasOwnProperty.call(rows[0]!, 'phone')) {
      throw new AppError(ERROR_CODES.VALIDATION, 'CSV must contain a "phone" column', 400);
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const phoneRaw = (row['phone'] ?? '').trim();
      if (!phoneRaw) {
        summary.errors.push({ row: i + 2, phone: '', reason: 'empty phone' });
        summary.skipped++;
        continue;
      }
      const v = validateAndNormalizePhone(phoneRaw, this.env.DEFAULT_PHONE_REGION);
      if (!v.valid) {
        summary.errors.push({ row: i + 2, phone: phoneRaw, reason: v.reason });
        summary.skipped++;
        continue;
      }
      try {
        const { created } = await this.repo.upsertByPhone({
          phoneE164: v.e164,
          name: row['name']?.trim() || null,
          email: row['email']?.trim() || null,
        });
        if (created) summary.imported++;
        else summary.updated++;
      } catch (err) {
        this.logger.warn({ err, row: i + 2 }, 'csv row import failed');
        summary.errors.push({ row: i + 2, phone: phoneRaw, reason: 'db error' });
        summary.skipped++;
      }
    }
    return summary;
  }
}
