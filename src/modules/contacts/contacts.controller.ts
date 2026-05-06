import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ContactsService } from './contacts.service.js';
import type {
  ContactIdParamT,
  CreateContactBodyT,
  ImportCsvBodyT,
  ListContactsQueryT,
} from './contacts.schemas.js';

export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  list = async (
    req: FastifyRequest<{ Querystring: ListContactsQueryT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.list({
      search: req.query.search,
      page: req.query.page ?? 1,
      pageSize: req.query.pageSize ?? 50,
    });
    reply.send({ success: true, data: out, error: null, meta: meta(req) });
  };

  create = async (
    req: FastifyRequest<{ Body: CreateContactBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.create({
      phone: req.body.phone,
      name: req.body.name ?? null,
      email: req.body.email ?? null,
    });
    reply.code(201).send({ success: true, data: out, error: null, meta: meta(req) });
  };

  remove = async (
    req: FastifyRequest<{ Params: ContactIdParamT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await this.service.delete(req.params.id);
    reply.code(204).send();
  };

  import = async (
    req: FastifyRequest<{ Body: ImportCsvBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.importCsv(req.body.csv);
    reply.send({ success: true, data: out, error: null, meta: meta(req) });
  };
}

function meta(req: FastifyRequest) {
  return { requestId: req.correlationId, timestamp: new Date().toISOString() };
}
