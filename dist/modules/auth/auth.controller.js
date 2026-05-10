export class AuthController {
    service;
    accessTokens;
    constructor(service, accessTokens) {
        this.service = service;
        this.accessTokens = accessTokens;
    }
    sendCode = async (req, reply) => {
        const out = await this.service.sendCode({
            rawPhone: req.body.phone,
            ipAddress: req.ip ?? null,
            userAgent: req.headers['user-agent'] ?? null,
            correlationId: req.correlationId,
        });
        reply.send({
            success: true,
            data: out,
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
    verifyCode = async (req, reply) => {
        const out = await this.service.verifyCode({
            rawPhone: req.body.phone,
            code: req.body.code,
            ipAddress: req.ip ?? null,
            correlationId: req.correlationId,
        });
        reply.send({
            success: true,
            data: out,
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
    createAccessLink = async (req, reply) => {
        const out = await this.accessTokens.createAccessLink({
            rawPhone: req.body.phoneE164,
            role: req.body.role ?? 'ADMIN',
            initialTokens: req.body.initialTokens,
            actorId: req.authUser?.id,
            actorType: 'admin',
            correlationId: req.correlationId,
        });
        reply.send({
            success: true,
            data: out,
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
}
