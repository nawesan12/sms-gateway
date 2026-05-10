import { ContactListsService } from './contact-lists.service.js';
import { ContactListsController } from './contact-lists.controller.js';
import { AddMembersBody, CreateListBody, ListIdParam, ListMemberParam, ListMembersQuery, UpdateListBody, } from './contact-lists.schemas.js';
export async function registerContactListsRoutes(app) {
    const service = new ContactListsService(app.prisma);
    const controller = new ContactListsController(service);
    app.get('/v1/contact-lists', {
        preHandler: app.requireAdmin,
        schema: { tags: ['contact-lists'], security: [{ bearerAuth: [] }, { bootstrapToken: [] }] },
    }, controller.list);
    app.post('/v1/contact-lists', {
        preHandler: app.requireAdmin,
        schema: {
            body: CreateListBody,
            tags: ['contact-lists'],
            security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
        },
    }, controller.create);
    app.get('/v1/contact-lists/:id', {
        preHandler: app.requireAdmin,
        schema: { params: ListIdParam, tags: ['contact-lists'], security: [{ bearerAuth: [] }] },
    }, controller.getById);
    app.get('/v1/contact-lists/:id/members', {
        preHandler: app.requireAdmin,
        schema: {
            params: ListIdParam,
            querystring: ListMembersQuery,
            tags: ['contact-lists'],
            security: [{ bearerAuth: [] }],
        },
    }, controller.getMembers);
    app.patch('/v1/contact-lists/:id', {
        preHandler: app.requireAdmin,
        schema: {
            params: ListIdParam,
            body: UpdateListBody,
            tags: ['contact-lists'],
            security: [{ bearerAuth: [] }],
        },
    }, controller.update);
    app.delete('/v1/contact-lists/:id', {
        preHandler: app.requireAdmin,
        schema: { params: ListIdParam, tags: ['contact-lists'], security: [{ bearerAuth: [] }] },
    }, controller.remove);
    app.post('/v1/contact-lists/:id/members', {
        preHandler: app.requireAdmin,
        schema: {
            params: ListIdParam,
            body: AddMembersBody,
            tags: ['contact-lists'],
            security: [{ bearerAuth: [] }],
        },
    }, controller.addMembers);
    app.delete('/v1/contact-lists/:id/members/:contactId', {
        preHandler: app.requireAdmin,
        schema: { params: ListMemberParam, tags: ['contact-lists'], security: [{ bearerAuth: [] }] },
    }, controller.removeMember);
}
