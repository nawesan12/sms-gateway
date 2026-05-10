import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
export default fp(async (app) => {
    await app.register(rateLimit, {
        global: false,
        redis: app.redis,
        keyGenerator: (req) => req.ip,
    });
}, { name: 'rate-limit', dependencies: ['redis'] });
