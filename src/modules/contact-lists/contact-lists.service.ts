import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';

export interface CreateListInput {
  name: string;
  description?: string | null;
}

export interface UpdateListInput {
  name?: string;
  description?: string | null;
}

export interface BulkAddFromSearchInput {
  search?: string;
  limit: number;
  dryRun?: boolean;
  onlyWithoutList?: boolean;
}

export interface BulkAddFromSearchResult {
  added: number;
  matched: number;
  requested: number;
  dryRun: boolean;
}

export class ContactListsService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateListInput) {
    return this.prisma.contactList.create({
      data: { name: input.name, description: input.description ?? null },
    });
  }

  async list() {
    const lists = await this.prisma.contactList.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true } } },
    });
    return lists.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      memberCount: l._count.members,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }));
  }

  async getById(id: string) {
    const list = await this.prisma.contactList.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!list) throw new AppError(ERROR_CODES.NOT_FOUND, 'List not found', 404);
    return {
      id: list.id,
      name: list.name,
      description: list.description,
      memberCount: list._count.members,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    };
  }

  async listMembers(id: string, args: { page: number; pageSize: number }) {
    await this.assertExists(id);
    const skip = (args.page - 1) * args.pageSize;
    const [members, total] = await Promise.all([
      this.prisma.contactListMember.findMany({
        where: { listId: id },
        include: { contact: true },
        orderBy: { addedAt: 'desc' },
        skip,
        take: args.pageSize,
      }),
      this.prisma.contactListMember.count({ where: { listId: id } }),
    ]);
    return {
      items: members.map((m) => m.contact),
      total,
      page: args.page,
      pageSize: args.pageSize,
    };
  }

  async update(id: string, input: UpdateListInput) {
    await this.assertExists(id);
    return this.prisma.contactList.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
  }

  async delete(id: string) {
    await this.assertExists(id);
    // Campaign.list tiene FK Restrict: si hay campañas asociadas, Prisma rompe
    // con P2003 y desde el front no se ve el error. Pre-chequeo para devolver
    // 409 claro. Los members tienen Cascade en el schema, no hay que tocarlos.
    const campaigns = await this.prisma.campaign.count({ where: { listId: id } });
    if (campaigns > 0) {
      throw new AppError(
        ERROR_CODES.VALIDATION,
        `No se puede borrar: la lista tiene ${campaigns} campaña${campaigns === 1 ? '' : 's'} asociada${campaigns === 1 ? '' : 's'}. Borrá primero las campañas.`,
        409,
      );
    }
    await this.prisma.contactList.delete({ where: { id } });
  }

  async addMembers(listId: string, contactIds: string[]) {
    await this.assertExists(listId);
    if (contactIds.length === 0) return { added: 0 };
    // Validate contacts exist
    const found = await this.prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true },
    });
    const validIds = new Set(found.map((c) => c.id));
    const valid = contactIds.filter((id) => validIds.has(id));
    if (valid.length === 0) return { added: 0 };
    const result = await this.prisma.contactListMember.createMany({
      data: valid.map((contactId) => ({ listId, contactId })),
      skipDuplicates: true,
    });
    return { added: result.count };
  }

  async bulkAddFromSearch(
    listId: string,
    input: BulkAddFromSearchInput,
  ): Promise<BulkAddFromSearchResult> {
    await this.assertExists(listId);

    const search = input.search?.trim();
    const searchWhere: Prisma.ContactWhereInput = search
      ? {
          OR: [
            { phoneE164: { contains: search } },
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    // Tomamos solo contactos activos. Si `onlyWithoutList` es true, filtramos
    // por contactos que no pertenezcan a NINGUNA lista. Si no, filtramos por
    // los que no estén en ESTA lista. Ambos casos usan NOT EXISTS en SQL.
    const candidates = await this.prisma.contact.findMany({
      where: {
        isActive: true,
        ...searchWhere,
        lists: input.onlyWithoutList ? { none: {} } : { none: { listId } },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: input.limit,
    });

    if (input.dryRun || candidates.length === 0) {
      return {
        added: 0,
        matched: candidates.length,
        requested: input.limit,
        dryRun: input.dryRun ?? false,
      };
    }

    // skipDuplicates cubre la race condition: si otro request agregó el mismo
    // contacto entre el SELECT y el INSERT, ON CONFLICT lo ignora.
    const result = await this.prisma.contactListMember.createMany({
      data: candidates.map((c) => ({ listId, contactId: c.id })),
      skipDuplicates: true,
    });

    return {
      added: result.count,
      matched: candidates.length,
      requested: input.limit,
      dryRun: false,
    };
  }

  async removeMember(listId: string, contactId: string) {
    await this.assertExists(listId);
    await this.prisma.contactListMember.deleteMany({ where: { listId, contactId } });
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.contactList.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new AppError(ERROR_CODES.NOT_FOUND, 'List not found', 404);
  }
}
