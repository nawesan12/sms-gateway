import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { AppEnv } from '@/config/env.js';
import { QUEUE_NAMES } from '@/config/constants.js';
import type { CampaignSendJob, DeviceHealthJob, SmsSendJob } from './jobs/job.types.js';

export function buildBullConnection(env: AppEnv): IORedis {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export function buildSmsQueue(env: AppEnv): { queue: Queue<SmsSendJob>; client: IORedis } {
  const client = buildBullConnection(env);
  const queue = new Queue<SmsSendJob>(QUEUE_NAMES.SMS_SEND, { connection: client });
  return { queue, client };
}

export function buildDeviceHealthQueue(env: AppEnv): {
  queue: Queue<DeviceHealthJob>;
  client: IORedis;
} {
  const client = buildBullConnection(env);
  const queue = new Queue<DeviceHealthJob>(QUEUE_NAMES.DEVICE_HEALTH, { connection: client });
  return { queue, client };
}

export function buildDlqQueue(env: AppEnv): { queue: Queue<SmsSendJob>; client: IORedis } {
  const client = buildBullConnection(env);
  const queue = new Queue<SmsSendJob>(QUEUE_NAMES.SMS_DLQ, { connection: client });
  return { queue, client };
}

export function buildCampaignQueue(env: AppEnv): {
  queue: Queue<CampaignSendJob>;
  client: IORedis;
} {
  const client = buildBullConnection(env);
  const queue = new Queue<CampaignSendJob>(QUEUE_NAMES.CAMPAIGN_SEND, { connection: client });
  return { queue, client };
}
