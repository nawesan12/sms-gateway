import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ContactListsService } from './contact-lists.service.js';
import type {
  AddMembersBodyT,
  CreateListBodyT,
  ListIdParamT,
  ListMemberParamT,
  ListMembersQueryT,
  UpdateListBodyT,
} from './contact-lists.schemas.js';

export class ContactListsController {
  constructor(private readonly service: ContactListsService) {}

  list = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const items = await this.service.list();
    reply.send({
      success: true,
      data: { items, total: items.length },
      error: null,
      meta: meta(req),
    });
  };

  create = async (
    req: FastifyRequest<{ Body: CreateListBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.create({
      name: req.body.name,
      description: req.body.description ?? null,
    });
    reply.code(201).send({ success: true, data: out, error: null, meta: meta(req) });
  };

  getById = async (
    req: FastifyRequest<{ Params: ListIdParamT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.getById(req.params.id);
    reply.send({ success: true, data: out, error: null, meta: meta(req) });
  };

  getMembers = async (
    req: FastifyRequest<{ Params: ListIdParamT; Querystring: ListMembersQueryT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.listMembers(req.params.id, {
      page: req.query.page ?? 1,
      pageSize: req.query.pageSize ?? 50,
    });
    reply.send({ success: true, data: out, error: null, meta: meta(req) });
  };

  update = async (
    req: FastifyRequest<{ Params: ListIdParamT; Body: UpdateListBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.update(req.params.id, req.body);
    reply.send({ success: true, data: out, error: null, meta: meta(req) });
  };

  remove = async (
    req: FastifyRequest<{ Params: ListIdParamT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await this.service.delete(req.params.id);
    reply.code(204).send();
  };

  addMembers = async (
    req: FastifyRequest<{ Params: ListIdParamT; Body: AddMembersBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.addMembers(req.params.id, req.body.contactIds);
    reply.send({ success: true, data: out, error: null, meta: meta(req) });
  };

  removeMember = async (
    req: FastifyRequest<{ Params: ListMemberParamT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await this.service.removeMember(req.params.id, req.params.contactId);
    reply.code(204).send();
  };
}

function meta(req: FastifyRequest) {
  return { requestId: req.correlationId, timestamp: new Date().toISOString() };
}
