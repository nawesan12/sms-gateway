import type { PrismaClient } from '@prisma/client';
import { QUEUE_NAMES } from '@/config/constants.js';
import { PgQueue } from './pg-queue.js';
import type { CampaignSendJob, DeviceHealthJob, SmsSendJob } from './jobs/job.types.js';

// Después de migrar de BullMQ/Redis a Postgres, las queues son objetos
// stateless: solo necesitan un PrismaClient. No hay client a cerrar.

export function buildSmsQueue(prisma: PrismaClient): PgQueue<SmsSendJob> {
  return new PgQueue<SmsSendJob>(prisma, QUEUE_NAMES.SMS_SEND);
}

export function buildDeviceHealthQueue(prisma: PrismaClient): PgQueue<DeviceHealthJob> {
  return new PgQueue<DeviceHealthJob>(prisma, QUEUE_NAMES.DEVICE_HEALTH);
}

export function buildDlqQueue(prisma: PrismaClient): PgQueue<SmsSendJob> {
  return new PgQueue<SmsSendJob>(prisma, QUEUE_NAMES.SMS_DLQ);
}

export function buildCampaignQueue(prisma: PrismaClient): PgQueue<CampaignSendJob> {
  return new PgQueue<CampaignSendJob>(prisma, QUEUE_NAMES.CAMPAIGN_SEND);
}
