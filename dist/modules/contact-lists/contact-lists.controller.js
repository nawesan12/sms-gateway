export class ContactListsController {
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
            meta: meta(req),
        });
    };
    create = async (req, reply) => {
        const out = await this.service.create({
            name: req.body.name,
            description: req.body.description ?? null,
        });
        reply.code(201).send({ success: true, data: out, error: null, meta: meta(req) });
    };
    getById = async (req, reply) => {
        const out = await this.service.getById(req.params.id);
        reply.send({ success: true, data: out, error: null, meta: meta(req) });
    };
    getMembers = async (req, reply) => {
        const out = await this.service.listMembers(req.params.id, {
            page: req.query.page ?? 1,
            pageSize: req.query.pageSize ?? 50,
        });
        reply.send({ success: true, data: out, error: null, meta: meta(req) });
    };
    update = async (req, reply) => {
        const out = await this.service.update(req.params.id, req.body);
        reply.send({ success: true, data: out, error: null, meta: meta(req) });
    };
    remove = async (req, reply) => {
        await this.service.delete(req.params.id);
        reply.code(204).send();
    };
    addMembers = async (req, reply) => {
        const out = await this.service.addMembers(req.params.id, req.body.contactIds);
        reply.send({ success: true, data: out, error: null, meta: meta(req) });
    };
    removeMember = async (req, reply) => {
        await this.service.removeMember(req.params.id, req.params.contactId);
        reply.code(204).send();
    };
}
function meta(req) {
    return { requestId: req.correlationId, timestamp: new Date().toISOString() };
}
