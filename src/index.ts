import { buildApp } from './app.js';
import { syncDatabaseSchema } from './bootstrap/db-sync.js';
import { seedAdminIfMissing } from './bootstrap/seed-admin.js';
import { startSmsSendWorker } from './queue/workers/sms-send.worker.js';
import { startDeviceHealthWorker } from './queue/workers/device-health.worker.js';
import { startCampaignSendWorker } from './queue/workers/campaign-send.worker.js';
import { startCampaignWatchdog } from './queue/workers/campaign-watchdog.worker.js';

async function main(): Promise<void> {
  const app = await buildApp();
  const env = app.env;
  const bootstrapLog = app.log.child({ scope: 'bootstrap' });

  // Schema sync: apagado por defecto. `prisma db push` contra un pooler puede
  // colgarse esperando un advisory lock, y el boot nunca llega a app.listen();
  // el PaaS entonces mata el proceso por no abrir puerto. El schema se aplica
  // a mano con `npx prisma db push` apuntando al session pooler (puerto 5432).
  // Poner DB_PUSH_ON_BOOT=true para recuperar el comportamiento anterior.
  if (process.env['DB_PUSH_ON_BOOT'] === 'true') {
    try {
      await syncDatabaseSchema(bootstrapLog);
    } catch (err) {
      bootstrapLog.error({ err }, 'db schema sync failed — continuando sin sincronizar');
    }
  } else {
    bootstrapLog.info('db schema sync omitido (DB_PUSH_ON_BOOT != true)');
  }

  // Auto-seed del admin operador (idempotente). En Render free no hay Shell,
  // así que `npm run prisma:seed` no es viable; lo hacemos en cada boot.
  await seedAdminIfMissing({
    prisma: app.prisma,
    phoneE164: env.BOOTSTRAP_ADMIN_PHONE,
    logger: bootstrapLog,
  });

  // En plan free de Render no hay Background Workers, así que los corremos
  // dentro del mismo proceso de la API. Si el web service se duerme por
  // inactividad, los workers también — usar un keepalive externo para evitarlo.
  const workerLogger = app.log.child({ scope: 'workers' });
  const smsHandle = startSmsSendWorker(env, workerLogger.child({ component: 'sms-worker' }));
  const healthHandle = startDeviceHealthWorker(
    env,
    workerLogger.child({ component: 'health-worker' }),
  );
  const campaignHandle = startCampaignSendWorker(
    env,
    workerLogger.child({ component: 'campaign-worker' }),
  );
  const watchdogHandle = startCampaignWatchdog(
    env,
    workerLogger.child({ component: 'campaign-watchdog' }),
  );

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down API + workers');
    try {
      await Promise.all([
        smsHandle.shutdown(),
        healthHandle.shutdown(),
        campaignHandle.shutdown(),
        watchdogHandle.shutdown(),
      ]);
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    const address = await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info({ address }, 'API + workers listening');
  } catch (err) {
    app.log.error({ err }, 'failed to start');
    process.exit(1);
  }
}

void main();
