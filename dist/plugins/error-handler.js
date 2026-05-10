import fp from 'fastify-plugin';
import { ERROR_CODES } from '@/config/constants.js';
export class AppError extends Error {
    code;
    statusCode;
    details;
    constructor(code, message, statusCode = 400, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}
const STATUS_BY_CODE = {
    [ERROR_CODES.UNAUTHORIZED]: 401,
    [ERROR_CODES.FORBIDDEN]: 403,
    [ERROR_CODES.NOT_FOUND]: 404,
    [ERROR_CODES.RATE_LIMITED_IP]: 429,
    [ERROR_CODES.RATE_LIMITED_PHONE]: 429,
    [ERROR_CODES.COOLDOWN_ACTIVE]: 429,
    [ERROR_CODES.INSUFFICIENT_TOKENS]: 402,
    [ERROR_CODES.INTERNAL_ERROR]: 500,
    [ERROR_CODES.SMS_PROVIDER_DOWN]: 502,
    [ERROR_CODES.DEVICE_OFFLINE]: 503,
};
export default fp(async (app) => {
    app.setErrorHandler((err, req, reply) => {
        const correlationId = req.correlationId;
        if (err instanceof AppError) {
            const status = err.statusCode || STATUS_BY_CODE[err.code] || 400;
            req.log.warn({ code: err.code, details: err.details }, err.message);
            return reply.status(status).send({
                success: false,
                data: null,
                error: { code: err.code, message: err.message, details: err.details ?? undefined },
                meta: { requestId: correlationId, timestamp: new Date().toISOString() },
            });
        }
        // Fastify validation errors
        const errAsAny = err;
        if (errAsAny.validation) {
            return reply.status(400).send({
                success: false,
                data: null,
                error: {
                    code: ERROR_CODES.VALIDATION,
                    message: errAsAny.message ?? 'validation error',
                    details: errAsAny.validation,
                },
                meta: { requestId: correlationId, timestamp: new Date().toISOString() },
            });
        }
        // Rate-limit plugin
        if (err.statusCode === 429) {
            return reply.status(429).send({
                success: false,
                data: null,
                error: { code: ERROR_CODES.RATE_LIMITED_IP, message: 'Too Many Requests' },
                meta: { requestId: correlationId, timestamp: new Date().toISOString() },
            });
        }
        const errAny = err;
        const status = errAny.statusCode ?? 500;
        const code = status >= 500 ? ERROR_CODES.INTERNAL_ERROR : ERROR_CODES.VALIDATION;
        req.log.error({ err }, 'unhandled error');
        return reply.status(status).send({
            success: false,
            data: null,
            error: {
                code,
                message: status >= 500 ? 'Internal server error' : (errAny.message ?? 'error'),
            },
            meta: { requestId: correlationId, timestamp: new Date().toISOString() },
        });
    });
}, { name: 'error-handler' });
