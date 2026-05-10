export class DevicesController {
    service;
    constructor(service) {
        this.service = service;
    }
    list = async (req, reply) => {
        const items = await this.service.list();
        reply.send({
            success: true,
            data: { items, total: items.length },
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
    create = async (req, reply) => {
        const actorId = req.authUser?.id ?? 'unknown';
        const created = await this.service.create(req.body, actorId, req.correlationId);
        reply.code(201).send({
            success: true,
            data: created,
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
    update = async (req, reply) => {
        const actorId = req.authUser?.id ?? 'unknown';
        const updated = await this.service.update(req.params.id, req.body, actorId, req.correlationId);
        reply.send({
            success: true,
            data: updated,
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
    remove = async (req, reply) => {
        const actorId = req.authUser?.id ?? 'unknown';
        await this.service.remove(req.params.id, actorId, req.correlationId);
        reply.code(204).send();
    };
}
