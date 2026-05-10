import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';
export class MessagingController {
    service;
    constructor(service) {
        this.service = service;
    }
    send = async (req, reply) => {
        if (!req.authUser || req.authUser.id === 'bootstrap') {
            throw new AppError(ERROR_CODES.FORBIDDEN, 'Send requires a client access token (operator bootstrap cannot send SMS to avoid debiting unidentified accounts)', 403);
        }
        const out = await this.service.sendOne({
            rawPhone: req.body.phone,
            message: req.body.message,
            contactId: req.body.contactId ?? null,
            ownerUserId: req.authUser.id,
            correlationId: req.correlationId,
        });
        reply.code(202).send({
            success: true,
            data: out,
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
    status = async (req, reply) => {
        const sms = await this.service.getSmsStatus(req.params.id);
        reply.send({
            success: true,
            data: sms,
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
}
