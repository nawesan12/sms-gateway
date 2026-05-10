import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES } from '@/config/constants.js';
export function buildBullConnection(env) {
    return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
export function buildSmsQueue(env) {
    const client = buildBullConnection(env);
    const queue = new Queue(QUEUE_NAMES.SMS_SEND, { connection: client });
    return { queue, client };
}
export function buildDeviceHealthQueue(env) {
    const client = buildBullConnection(env);
    const queue = new Queue(QUEUE_NAMES.DEVICE_HEALTH, { connection: client });
    return { queue, client };
}
export function buildDlqQueue(env) {
    const client = buildBullConnection(env);
    const queue = new Queue(QUEUE_NAMES.SMS_DLQ, { connection: client });
    return { queue, client };
}
export function buildCampaignQueue(env) {
    const client = buildBullConnection(env);
    const queue = new Queue(QUEUE_NAMES.CAMPAIGN_SEND, { connection: client });
    return { queue, client };
}
