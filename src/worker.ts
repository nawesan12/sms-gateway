import { loadEnv } from './config/env.js';
import { buildLogger } from './plugins/logger.js';
import { startSmsSendWorker } from './queue/workers/sms-send.worker.js';
import { startDeviceHealthWorker } from './queue/workers/device-health.worker.js';
import { startCampaignSendWorker } from './queue/workers/campaign-send.worker.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = buildLogger(env);
  logger.info('starting workers');

  const smsHandle = startSmsSendWorker(env, logger.child({ component: 'sms-worker' }));
  const healthHandle = await startDeviceHealthWorker(
    env,
    logger.child({ component: 'health-worker' }),
  );
  const campaignHandle = startCampaignSendWorker(
    env,
    logger.child({ component: 'campaign-worker' }),
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down workers');
    try {
      await Promise.all([smsHandle.shutdown(), healthHandle.shutdown(), campaignHandle.shutdown()]);
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'shutdown error');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  logger.info('workers up');
}

void main();
