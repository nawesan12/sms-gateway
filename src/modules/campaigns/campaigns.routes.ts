import type { FastifyInstance } from 'fastify';
import { CampaignsService } from './campaigns.service.js';
import { CampaignsController } from './campaigns.controller.js';
import { buildCampaignQueue } from '@/queue/queues.js';
import {
  CampaignDeliveriesQuery,
  CampaignIdParam,
  CreateCampaignBody,
  ListCampaignsQuery,
  UpdateCampaignBody,
  type CampaignDeliveriesQueryT,
  type CampaignIdParamT,
  type CreateCampaignBodyT,
  type ListCampaignsQueryT,
  type UpdateCampaignBodyT,
} from './campaigns.schemas.js';

export async function registerCampaignsRoutes(app: FastifyInstance): Promise<void> {
  const campaignQueue = buildCampaignQueue(app.prisma);
  const service = new CampaignsService(app.prisma, app.env, app.log, campaignQueue);
  const controller = new CampaignsController(service);

  app.get<{ Querystring: ListCampaignsQueryT }>(
    '/v1/campaigns',
    {
      preHandler: app.requireAdmin,
      schema: {
        querystring: ListCampaignsQuery,
        tags: ['campaigns'],
        security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
      },
    },
    controller.list,
  );

  app.post<{ Body: CreateCampaignBodyT }>(
    '/v1/campaigns',
    {
      preHandler: app.requireAdmin,
      schema: {
        body: CreateCampaignBody,
        tags: ['campaigns'],
        security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
      },
    },
    controller.create,
  );

  app.get<{ Params: CampaignIdParamT }>(
    '/v1/campaigns/:id',
    {
      preHandler: app.requireAdmin,
      schema: { params: CampaignIdParam, tags: ['campaigns'], security: [{ bearerAuth: [] }] },
    },
    controller.getById,
  );

  app.get<{ Params: CampaignIdParamT; Querystring: CampaignDeliveriesQueryT }>(
    '/v1/campaigns/:id/deliveries',
    {
      preHandler: app.requireAdmin,
      schema: {
        params: CampaignIdParam,
        querystring: CampaignDeliveriesQuery,
        tags: ['campaigns'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.getDeliveries,
  );

  app.post<{ Params: CampaignIdParamT }>(
    '/v1/campaigns/:id/launch',
    {
      preHandler: app.requireAdmin,
      schema: { params: CampaignIdParam, tags: ['campaigns'], security: [{ bearerAuth: [] }] },
    },
    controller.launch,
  );

  app.post<{ Params: CampaignIdParamT }>(
    '/v1/campaigns/:id/cancel',
    {
      preHandler: app.requireAdmin,
      schema: { params: CampaignIdParam, tags: ['campaigns'], security: [{ bearerAuth: [] }] },
    },
    controller.cancel,
  );

  app.patch<{ Params: CampaignIdParamT; Body: UpdateCampaignBodyT }>(
    '/v1/campaigns/:id',
    {
      preHandler: app.requireAdmin,
      schema: {
        params: CampaignIdParam,
        body: UpdateCampaignBody,
        tags: ['campaigns'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.update,
  );

  app.post<{ Params: CampaignIdParamT }>(
    '/v1/campaigns/:id/retry-unconfirmed',
    {
      preHandler: app.requireAdmin,
      schema: { params: CampaignIdParam, tags: ['campaigns'], security: [{ bearerAuth: [] }] },
    },
    controller.retryUnconfirmed,
  );
}
