import { AppError } from '../../plugins/error-handler.js';
import { ERROR_CODES } from '../../config/constants.js';
export class ContactListsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(input) {
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
    async getById(id) {
        const list = await this.prisma.contactList.findUnique({
            where: { id },
            include: { _count: { select: { members: true } } },
        });
        if (!list)
            throw new AppError(ERROR_CODES.NOT_FOUND, 'List not found', 404);
        return {
            id: list.id,
            name: list.name,
            description: list.description,
            memberCount: list._count.members,
            createdAt: list.createdAt,
            updatedAt: list.updatedAt,
        };
    }
    async listMembers(id, args) {
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
    async update(id, input) {
        await this.assertExists(id);
        return this.prisma.contactList.update({
            where: { id },
            data: {
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.description !== undefined ? { description: input.description } : {}),
            },
        });
    }
    async delete(id) {
        await this.assertExists(id);
        await this.prisma.contactList.delete({ where: { id } });
    }
    async addMembers(listId, contactIds) {
        await this.assertExists(listId);
        if (contactIds.length === 0)
            return { added: 0 };
        // Validate contacts exist
        const found = await this.prisma.contact.findMany({
            where: { id: { in: contactIds } },
            select: { id: true },
        });
        const validIds = new Set(found.map((c) => c.id));
        const valid = contactIds.filter((id) => validIds.has(id));
        if (valid.length === 0)
            return { added: 0 };
        const result = await this.prisma.contactListMember.createMany({
            data: valid.map((contactId) => ({ listId, contactId })),
            skipDuplicates: true,
        });
        return { added: result.count };
    }
    async removeMember(listId, contactId) {
        await this.assertExists(listId);
        await this.prisma.contactListMember.deleteMany({ where: { listId, contactId } });
    }
    async assertExists(id) {
        const exists = await this.prisma.contactList.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!exists)
            throw new AppError(ERROR_CODES.NOT_FOUND, 'List not found', 404);
    }
}
