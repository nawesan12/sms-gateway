import { ContactsService } from './contacts.service.js';
import { ContactsController } from './contacts.controller.js';
import { ContactIdParam, CreateContactBody, ImportCsvBody, ListContactsQuery, } from './contacts.schemas.js';
export async function registerContactsRoutes(app) {
    const service = new ContactsService(app.prisma, app.env, app.log);
    const controller = new ContactsController(service);
    app.get('/v1/contacts', {
        preHandler: app.requireAdmin,
        schema: {
            querystring: ListContactsQuery,
            tags: ['contacts'],
            security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
        },
    }, controller.list);
    app.post('/v1/contacts', {
        preHandler: app.requireAdmin,
        schema: {
            body: CreateContactBody,
            tags: ['contacts'],
            security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
        },
    }, controller.create);
    app.delete('/v1/contacts/:id', {
        preHandler: app.requireAdmin,
        schema: {
            params: ContactIdParam,
            tags: ['contacts'],
            security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
        },
    }, controller.remove);
    app.post('/v1/contacts/import', {
        preHandler: app.requireAdmin,
        schema: {
            body: ImportCsvBody,
            tags: ['contacts'],
            security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
        },
        bodyLimit: 4 * 1024 * 1024, // 4MB CSV
    }, controller.import);
}
