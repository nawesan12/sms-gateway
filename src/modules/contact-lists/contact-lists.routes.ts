import type { FastifyInstance } from 'fastify';
import { ContactListsService } from './contact-lists.service.js';
import { ContactListsController } from './contact-lists.controller.js';
import {
  AddMembersBody,
  BulkAddMembersBody,
  CreateListBody,
  ListIdParam,
  ListMemberParam,
  ListMembersQuery,
  UpdateListBody,
  type AddMembersBodyT,
  type BulkAddMembersBodyT,
  type CreateListBodyT,
  type ListIdParamT,
  type ListMemberParamT,
  type ListMembersQueryT,
  type UpdateListBodyT,
} from './contact-lists.schemas.js';

export async function registerContactListsRoutes(app: FastifyInstance): Promise<void> {
  const service = new ContactListsService(app.prisma);
  const controller = new ContactListsController(service);

  app.get(
    '/v1/contact-lists',
    {
      preHandler: app.requireAdmin,
      schema: { tags: ['contact-lists'], security: [{ bearerAuth: [] }, { bootstrapToken: [] }] },
    },
    controller.list,
  );

  app.post<{ Body: CreateListBodyT }>(
    '/v1/contact-lists',
    {
      preHandler: app.requireAdmin,
      schema: {
        body: CreateListBody,
        tags: ['contact-lists'],
        security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
      },
    },
    controller.create,
  );

  app.get<{ Params: ListIdParamT }>(
    '/v1/contact-lists/:id',
    {
      preHandler: app.requireAdmin,
      schema: { params: ListIdParam, tags: ['contact-lists'], security: [{ bearerAuth: [] }] },
    },
    controller.getById,
  );

  app.get<{ Params: ListIdParamT; Querystring: ListMembersQueryT }>(
    '/v1/contact-lists/:id/members',
    {
      preHandler: app.requireAdmin,
      schema: {
        params: ListIdParam,
        querystring: ListMembersQuery,
        tags: ['contact-lists'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.getMembers,
  );

  app.patch<{ Params: ListIdParamT; Body: UpdateListBodyT }>(
    '/v1/contact-lists/:id',
    {
      preHandler: app.requireAdmin,
      schema: {
        params: ListIdParam,
        body: UpdateListBody,
        tags: ['contact-lists'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.update,
  );

  app.delete<{ Params: ListIdParamT }>(
    '/v1/contact-lists/:id',
    {
      preHandler: app.requireAdmin,
      schema: { params: ListIdParam, tags: ['contact-lists'], security: [{ bearerAuth: [] }] },
    },
    controller.remove,
  );

  app.post<{ Params: ListIdParamT; Body: AddMembersBodyT }>(
    '/v1/contact-lists/:id/members',
    {
      preHandler: app.requireAdmin,
      schema: {
        params: ListIdParam,
        body: AddMembersBody,
        tags: ['contact-lists'],
        security: [{ bearerAuth: [] }],
      },
      bodyLimit: 30 * 1024 * 1024,
    },
    controller.addMembers,
  );

  app.post<{ Params: ListIdParamT; Body: BulkAddMembersBodyT }>(
    '/v1/contact-lists/:id/members/bulk',
    {
      preHandler: app.requireAdmin,
      schema: {
        params: ListIdParam,
        body: BulkAddMembersBody,
        tags: ['contact-lists'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.bulkAddFromSearch,
  );

  app.delete<{ Params: ListMemberParamT }>(
    '/v1/contact-lists/:id/members/:contactId',
    {
      preHandler: app.requireAdmin,
      schema: { params: ListMemberParam, tags: ['contact-lists'], security: [{ bearerAuth: [] }] },
    },
    controller.removeMember,
  );
}
