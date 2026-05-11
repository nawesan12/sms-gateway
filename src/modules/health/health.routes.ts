import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  app.get('/health/ready', async (_req, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = {
      postgres: 'fail',
      fcm: 'fail',
      devices: 'fail',
    };

    try {
      await app.prisma.$queryRaw`SELECT 1`;
      checks.postgres = 'ok';
    } catch {
      // ignore
    }
    checks.fcm = app.fcm ? 'ok' : 'fail';
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
