import fp from 'fastify-plugin';
import Redis from 'ioredis';
export default fp(async (app) => {
    const client = new Redis(app.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
    });
    client.on('error', (err) => {
        app.log.error({ err }, 'redis error');
    });
    app.decorate('redis', client);
    app.addHook('onClose', async () => {
        await client.quit().catch(() => undefined);
    });
}, { name: 'redis', dependencies: ['env'] });
