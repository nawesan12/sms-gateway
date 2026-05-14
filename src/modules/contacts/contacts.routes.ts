import type { FastifyInstance } from 'fastify';
import { ContactsService } from './contacts.service.js';
import { ContactsController } from './contacts.controller.js';
import {
  BulkCreateContactsBody,
  ContactIdParam,
  CreateContactBody,
  ImportCsvBody,
  ListContactsQuery,
  type BulkCreateContactsBodyT,
  type ContactIdParamT,
  type CreateContactBodyT,
  type ImportCsvBodyT,
  type ListContactsQueryT,
} from './contacts.schemas.js';

export async function registerContactsRoutes(app: FastifyInstance): Promise<void> {
  const service = new ContactsService(app.prisma, app.env, app.log);
  const controller = new ContactsController(service);

  app.get<{ Querystring: ListContactsQueryT }>(
    '/v1/contacts',
    {
      preHandler: app.requireAdmin,
      schema: {
        querystring: ListContactsQuery,
        tags: ['contacts'],
        security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
      },
    },
    controller.list,
  );

  app.post<{ Body: CreateContactBodyT }>(
    '/v1/contacts',
    {
      preHandler: app.requireAdmin,
      schema: {
        body: CreateContactBody,
        tags: ['contacts'],
        security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
      },
    },
    controller.create,
  );

  app.delete<{ Params: ContactIdParamT }>(
    '/v1/contacts/:id',
    {
      preHandler: app.requireAdmin,
      schema: {
        params: ContactIdParam,
        tags: ['contacts'],
        security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
      },
    },
    controller.remove,
  );

  app.post<{ Body: ImportCsvBodyT }>(
    '/v1/contacts/import',
    {
      preHandler: app.requireAdmin,
      schema: {
        body: ImportCsvBody,
        tags: ['contacts'],
        security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
      },
      bodyLimit: 30 * 1024 * 1024, // 30MB CSV (~100k contactos)
    },
    controller.import,
  );

  app.post<{ Body: BulkCreateContactsBodyT }>(
    '/v1/contacts/bulk',
    {
      preHandler: app.requireAdmin,
      schema: {
        body: BulkCreateContactsBody,
        tags: ['contacts'],
        security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
      },
      bodyLimit: 10 * 1024 * 1024,
    },
    controller.bulkCreate,
  );
}
