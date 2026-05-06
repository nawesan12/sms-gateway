import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CampaignStatus } from '@prisma/client';
import type { CampaignsService } from './campaigns.service.js';
import type {
  CampaignDeliveriesQueryT,
  CampaignIdParamT,
  CreateCampaignBodyT,
  ListCampaignsQueryT,
} from './campaigns.schemas.js';

export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  list = async (
    req: FastifyRequest<{ Querystring: ListCampaignsQueryT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.list({
      status: req.query.status as CampaignStatus | undefined,
      page: req.query.page ?? 1,
      pageSize: req.query.pageSize ?? 50,
    });
    reply.send({ success: true, data: out, error: null, meta: meta(req) });
  };

  create = async (
    req: FastifyRequest<{ Body: CreateCampaignBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.create(
      {
        name: req.body.name,
        messageTemplate: req.body.messageTemplate,
        listId: req.body.listId,
        tpsLimit: req.body.tpsLimit,
      },
      req.correlationId,
    );
    reply.code(201).send({ success: true, data: out, error: null, meta: meta(req) });
  };

  getById = async (
    req: FastifyRequest<{ Params: CampaignIdParamT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.getById(req.params.id);
    reply.send({ success: true, data: out, error: null, meta: meta(req) });
  };

  getDeliveries = async (
    req: FastifyRequest<{ Params: CampaignIdParamT; Querystring: CampaignDeliveriesQueryT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.listDeliveries(req.params.id, {
      page: req.query.page ?? 1,
      pageSize: req.query.pageSize ?? 100,
    });
    reply.send({ success: true, data: out, error: null, meta: meta(req) });
  };

  launch = async (
    req: FastifyRequest<{ Params: CampaignIdParamT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.launch(req.params.id, req.correlationId);
    reply.code(202).send({ success: true, data: out, error: null, meta: meta(req) });
  };

  cancel = async (
    req: FastifyRequest<{ Params: CampaignIdParamT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await this.service.cancel(req.params.id, req.correlationId);
    reply.send({ success: true, data: { canceled: true }, error: null, meta: meta(req) });
  };
}

function meta(req: FastifyRequest) {
  return { requestId: req.correlationId, timestamp: new Date().toISOString() };
}
