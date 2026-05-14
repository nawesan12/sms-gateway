import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ContactsService } from './contacts.service.js';
import type {
  BulkCreateContactsBodyT,
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

  bulkCreate = async (
    req: FastifyRequest<{ Body: BulkCreateContactsBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const summary = await this.service.bulkCreate(req.body.phones, req.body.defaultName);
    reply.send({ success: true, data: summary, error: null, meta: meta(req) });
  };

  import = async (
    req: FastifyRequest<{ Body: ImportCsvBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const abort = new AbortController();
    const onClose = (): void => abort.abort();
    req.raw.once('close', onClose);

    const send = (event: unknown): void => {
      if (!raw.writableEnded) {
        raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    try {
      for await (const event of this.service.importCsv(req.body.csv, abort.signal)) {
        send(event);
        if (abort.signal.aborted) break;
      }
    } catch (err) {
      req.log.error({ err }, 'csv import stream failed');
      send({ phase: 'error', message: (err as Error).message ?? 'unknown error' });
    } finally {
      req.raw.off('close', onClose);
      if (!raw.writableEnded) raw.end();
    }
  };
}

function meta(req: FastifyRequest) {
  return { requestId: req.correlationId, timestamp: new Date().toISOString() };
}
