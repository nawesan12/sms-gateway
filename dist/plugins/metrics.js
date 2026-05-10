import fp from 'fastify-plugin';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { AppError } from './error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';
export function buildMetrics() {
    const registry = new Registry();
    collectDefaultMetrics({ register: registry, prefix: 'sms_gateway_' });
    const otpSent = new Counter({
        name: 'sms_gateway_otp_sent_total',
        help: 'OTP requests issued',
        labelNames: ['result'],
        registers: [registry],
    });
    const otpVerified = new Counter({
        name: 'sms_gateway_otp_verified_total',
        help: 'OTP verification attempts',
        labelNames: ['result'],
        registers: [registry],
    });
    const smsSent = new Counter({
        name: 'sms_gateway_sms_sent_total',
        help: 'SMS messages dispatched to provider',
        labelNames: ['device', 'result'],
        registers: [registry],
    });
    const smsErrors = new Counter({
        name: 'sms_gateway_sms_errors_total',
        help: 'SMS provider errors',
        labelNames: ['device', 'code'],
        registers: [registry],
    });
    const rateLimitBlocks = new Counter({
        name: 'sms_gateway_rate_limit_blocks_total',
        help: 'Requests blocked by rate limit',
        labelNames: ['scope'],
        registers: [registry],
    });
    const otpSendDuration = new Histogram({
        name: 'sms_gateway_otp_send_duration_seconds',
        help: 'Latency of /auth/send-code endpoint',
        buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
        registers: [registry],
    });
    const smsProviderLatency = new Histogram({
        name: 'sms_gateway_sms_provider_latency_seconds',
        help: 'TextBee provider call latency',
        labelNames: ['device', 'result'],
        buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
        registers: [registry],
    });
    const queueWait = new Histogram({
        name: 'sms_gateway_queue_wait_seconds',
        help: 'Time job spent waiting in queue',
        buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
        registers: [registry],
    });
    return {
        registry,
        otpSent,
        otpVerified,
        smsSent,
        smsErrors,
        rateLimitBlocks,
        otpSendDuration,
        smsProviderLatency,
        queueWait,
    };
}
export const metrics = buildMetrics();
export default fp(async (app) => {
    if (!app.env.METRICS_ENABLED)
        return;
    app.decorate('metrics', metrics);
    app.get('/metrics', async (req, reply) => {
        const allowlist = app.env.METRICS_IP_ALLOWLIST;
        if (allowlist.length > 0 && !allowlist.includes(req.ip)) {
            throw new AppError(ERROR_CODES.FORBIDDEN, 'metrics access denied', 403);
        }
        reply.header('content-type', metrics.registry.contentType);
        return metrics.registry.metrics();
    });
}, { name: 'metrics', dependencies: ['env', 'error-handler'] });
