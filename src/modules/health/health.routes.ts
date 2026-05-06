import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  app.get('/health/ready', async (_req, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = {
      postgres: 'fail',
      redis: 'fail',
      devices: 'fail',
    };

    try {
      await app.prisma.$queryRaw`SELECT 1`;
      checks.postgres = 'ok';
    } catch {
      // ignore
    }
    try {
      const pong = await app.redis.ping();
      if (pong === 'PONG') checks.redis = 'ok';
    } catch {
      // ignore
    }
    try {
      const count = await app.prisma.device.count({ where: { status: 'ACTIVE' } });
      checks.devices = count > 0 ? 'ok' : 'fail';
    } catch {
      // ignore
    }

    const ok = Object.values(checks).every((v) => v === 'ok');
    reply.code(ok ? 200 : 503).send({ status: ok ? 'ready' : 'degraded', checks });
  });
}
