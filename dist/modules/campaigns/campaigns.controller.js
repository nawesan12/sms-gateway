import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';
export class CampaignsController {
    service;
    constructor(service) {
        this.service = service;
    }
    list = async (req, reply) => {
        const out = await this.service.list({
            status: req.query.status,
            page: req.query.page ?? 1,
            pageSize: req.query.pageSize ?? 50,
        });
        reply.send({ success: true, data: out, error: null, meta: meta(req) });
    };
    create = async (req, reply) => {
        if (!req.authUser || req.authUser.id === 'bootstrap') {
            throw new AppError(ERROR_CODES.FORBIDDEN, 'Creating campaigns requires a client access token (operator bootstrap is for admin tasks only)', 403);
        }
        const out = await this.service.create({
            name: req.body.name,
            messageTemplate: req.body.messageTemplate,
            listId: req.body.listId,
            ownerUserId: req.authUser.id,
            tpsLimit: req.body.tpsLimit,
        }, req.correlationId);
        reply.code(201).send({ success: true, data: out, error: null, meta: meta(req) });
    };
    getById = async (req, reply) => {
        const out = await this.service.getById(req.params.id);
        reply.send({ success: true, data: out, error: null, meta: meta(req) });
    };
    getDeliveries = async (req, reply) => {
        const out = await this.service.listDeliveries(req.params.id, {
            page: req.query.page ?? 1,
            pageSize: req.query.pageSize ?? 100,
        });
        reply.send({ success: true, data: out, error: null, meta: meta(req) });
    };
    launch = async (req, reply) => {
        const out = await this.service.launch(req.params.id, req.correlationId);
        reply.code(202).send({ success: true, data: out, error: null, meta: meta(req) });
    };
    cancel = async (req, reply) => {
        await this.service.cancel(req.params.id, req.correlationId);
        reply.send({ success: true, data: { canceled: true }, error: null, meta: meta(req) });
    };
}
function meta(req) {
    return { requestId: req.correlationId, timestamp: new Date().toISOString() };
}
