#!/usr/bin/env node
// Diagnóstico read-only: status real de SmsMessages de una campaña.
// Compara CampaignDelivery.status (lo que dice el backend) vs SmsMessage.status
// (lo que reportó el celular).

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const campaignId = process.argv[2];
if (!campaignId) {
  console.error('Uso: node scripts/diagnose-sms.mjs <campaignId>');
  process.exit(1);
}

async function main() {
  console.log('\n== STATUS DE SmsMessage (lo que reportó el celular) ==');
  const smsByStatus = await prisma.$queryRaw`
    SELECT s.status, COUNT(*)::int AS count
    FROM "sms_messages" s
    INNER JOIN "campaign_deliveries" d ON d."smsMessageId" = s.id
    WHERE d."campaignId" = ${campaignId}
    GROUP BY s.status
    ORDER BY s.status
  `;
  console.table(smsByStatus);

  console.log('\n== TIMING: primer y último envío real al device (FCM accepted) ==');
  const timing = await prisma.$queryRaw`
    SELECT
      MIN(d."sentAt") AS first_sent,
      MAX(d."sentAt") AS last_sent,
      COUNT(d."sentAt")::int AS sent_with_timestamp
    FROM "campaign_deliveries" d
    WHERE d."campaignId" = ${campaignId}
  `;
  console.table(timing);

  console.log('\n== TIMING: primer y último reporte DESDE el device ==');
  const smsTiming = await prisma.$queryRaw`
    SELECT
      COUNT(s."sentAt")::int AS sent_reported,
      COUNT(s."deliveredAt")::int AS delivered_reported,
      MIN(s."sentAt") AS first_sent_reported,
      MAX(s."sentAt") AS last_sent_reported
    FROM "sms_messages" s
    INNER JOIN "campaign_deliveries" d ON d."smsMessageId" = s.id
    WHERE d."campaignId" = ${campaignId}
  `;
  console.table(smsTiming);

  console.log('\n== SmsMessage de muestra (los 5 primeros) ==');
  const sample = await prisma.$queryRaw`
    SELECT s.id, s.status, s."deviceId", s."sentAt", s."deliveredAt", s."failedAt",
           s."errorCode", s."errorMessage", s."retryCount"
    FROM "sms_messages" s
    INNER JOIN "campaign_deliveries" d ON d."smsMessageId" = s.id
    WHERE d."campaignId" = ${campaignId}
    ORDER BY s."createdAt" ASC
    LIMIT 5
  `;
  console.table(sample.map((s) => ({
    id: s.id.slice(0, 8),
    status: s.status,
    device: s.deviceId?.slice(0, 8),
    sentAt: s.sentAt?.toISOString().slice(11, 19) ?? '—',
    deliveredAt: s.deliveredAt?.toISOString().slice(11, 19) ?? '—',
    error: s.errorMessage ?? '',
  })));

  console.log('\n== Distribución por device ==');
  const byDevice = await prisma.$queryRaw`
    SELECT s."deviceId", s.status, COUNT(*)::int AS count
    FROM "sms_messages" s
    INNER JOIN "campaign_deliveries" d ON d."smsMessageId" = s.id
    WHERE d."campaignId" = ${campaignId}
    GROUP BY s."deviceId", s.status
    ORDER BY s."deviceId", s.status
  `;
  console.table(byDevice);
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
