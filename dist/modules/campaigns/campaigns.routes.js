import { CampaignsService } from './campaigns.service.js';
import { CampaignsController } from './campaigns.controller.js';
import { buildCampaignQueue } from '@/queue/queues.js';
import { CampaignDeliveriesQuery, CampaignIdParam, CreateCampaignBody, ListCampaignsQuery, } from './campaigns.schemas.js';
export async function registerCampaignsRoutes(app) {
    const { queue: campaignQueue, client: campaignQueueClient } = buildCampaignQueue(app.env);
    app.addHook('onClose', async () => {
        await campaignQueue.close();
        await campaignQueueClient.quit().catch(() => undefined);
    });
    const service = new CampaignsService(app.prisma, app.env, app.log, campaignQueue);
    const controller = new CampaignsController(service);
    app.get('/v1/campaigns', {
        preHandler: app.requireAdmin,
        schema: {
            querystring: ListCampaignsQuery,
            tags: ['campaigns'],
            security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
        },
    }, controller.list);
    app.post('/v1/campaigns', {
        preHandler: app.requireAdmin,
        schema: {
            body: CreateCampaignBody,
            tags: ['campaigns'],
            security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
        },
    }, controller.create);
    app.get('/v1/campaigns/:id', {
        preHandler: app.requireAdmin,
        schema: { params: CampaignIdParam, tags: ['campaigns'], security: [{ bearerAuth: [] }] },
    }, controller.getById);
    app.get('/v1/campaigns/:id/deliveries', {
        preHandler: app.requireAdmin,
        schema: {
            params: CampaignIdParam,
            querystring: CampaignDeliveriesQuery,
            tags: ['campaigns'],
            security: [{ bearerAuth: [] }],
        },
    }, controller.getDeliveries);
    app.post('/v1/campaigns/:id/launch', {
        preHandler: app.requireAdmin,
        schema: { params: CampaignIdParam, tags: ['campaigns'], security: [{ bearerAuth: [] }] },
    }, controller.launch);
    app.post('/v1/campaigns/:id/cancel', {
        preHandler: app.requireAdmin,
        schema: { params: CampaignIdParam, tags: ['campaigns'], security: [{ bearerAuth: [] }] },
    }, controller.cancel);
}
