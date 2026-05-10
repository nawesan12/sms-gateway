import { buildApp } from './app.js';
import { seedAdminIfMissing } from './bootstrap/seed-admin.js';
import { startSmsSendWorker } from './queue/workers/sms-send.worker.js';
import { startDeviceHealthWorker } from './queue/workers/device-health.worker.js';
import { startCampaignSendWorker } from './queue/workers/campaign-send.worker.js';
async function main() {
    const app = await buildApp();
    const env = app.env;
    // Auto-seed del admin operador (idempotente). En Render free no hay Shell,
    // así que `npm run prisma:seed` no es viable; lo hacemos en cada boot.
    await seedAdminIfMissing({
        prisma: app.prisma,
        phoneE164: env.BOOTSTRAP_ADMIN_PHONE,
        logger: app.log.child({ scope: 'bootstrap' }),
    });
    // En plan free de Render no hay Background Workers, así que los corremos
    // dentro del mismo proceso de la API. Si el web service se duerme por
    // inactividad, los workers también — usar un keepalive externo para evitarlo.
    const workerLogger = app.log.child({ scope: 'workers' });
    const smsHandle = startSmsSendWorker(env, workerLogger.child({ component: 'sms-worker' }));
    const healthHandle = await startDeviceHealthWorker(env, workerLogger.child({ component: 'health-worker' }));
    const campaignHandle = startCampaignSendWorker(env, workerLogger.child({ component: 'campaign-worker' }));
    const shutdown = async (signal) => {
        app.log.info({ signal }, 'shutting down API + workers');
        try {
            await Promise.all([smsHandle.shutdown(), healthHandle.shutdown(), campaignHandle.shutdown()]);
            await app.close();
            process.exit(0);
        }
        catch (err) {
            app.log.error({ err }, 'error during shutdown');
            process.exit(1);
        }
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    try {
        const address = await app.listen({ port: env.PORT, host: env.HOST });
        app.log.info({ address }, 'API + workers listening');
    }
    catch (err) {
        app.log.error({ err }, 'failed to start');
        process.exit(1);
    }
}
void main();
