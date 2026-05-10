export class ContactsController {
    service;
    constructor(service) {
        this.service = service;
    }
    list = async (req, reply) => {
        const out = await this.service.list({
            search: req.query.search,
            page: req.query.page ?? 1,
            pageSize: req.query.pageSize ?? 50,
        });
        reply.send({ success: true, data: out, error: null, meta: meta(req) });
    };
    create = async (req, reply) => {
        const out = await this.service.create({
            phone: req.body.phone,
            name: req.body.name ?? null,
            email: req.body.email ?? null,
        });
        reply.code(201).send({ success: true, data: out, error: null, meta: meta(req) });
    };
    remove = async (req, reply) => {
        await this.service.delete(req.params.id);
        reply.code(204).send();
    };
    import = async (req, reply) => {
        const out = await this.service.importCsv(req.body.csv);
        reply.send({ success: true, data: out, error: null, meta: meta(req) });
    };
}
function meta(req) {
    return { requestId: req.correlationId, timestamp: new Date().toISOString() };
}
