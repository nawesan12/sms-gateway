#!/usr/bin/env node
// Diagnóstico read-only: imprime estado de la última campaña, sus deliveries
// agrupadas por status, los jobs encolados, y el balance del owner.
// Uso:
//   node scripts/diagnose-campaign.mjs           # última campaña
//   node scripts/diagnose-campaign.mjs <id>      # campaña específica

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const argId = process.argv[2];

async function main() {
  const campaign = argId
    ? await prisma.campaign.findUnique({ where: { id: argId } })
    : await prisma.campaign.findFirst({ orderBy: { launchedAt: 'desc' } });

  if (!campaign) {
    console.log('No hay campañas.');
    return;
  }

  console.log('\n== CAMPAÑA ==');
  console.log({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    totalRecipients: campaign.totalRecipients,
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
    messagesPerHour: campaign.messagesPerHour,
    launchedAt: campaign.launchedAt,
    completedAt: campaign.completedAt,
    ownerUserId: campaign.ownerUserId,
  });

  console.log('\n== DELIVERIES POR STATUS ==');
  const byStatus = await prisma.campaignDelivery.groupBy({
    by: ['status'],
    where: { campaignId: campaign.id },
    _count: { _all: true },
  });
  console.table(byStatus.map((r) => ({ status: r.status, count: r._count._all })));

  console.log('\n== ÚLTIMOS 10 ERRORES DE DELIVERIES ==');
  const errors = await prisma.campaignDelivery.findMany({
    where: { campaignId: campaign.id, status: 'FAILED' },
    include: { contact: { select: { phoneE164: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.table(
    errors.map((d) => ({
      phone: d.contact.phoneE164,
      errorCode: d.errorCode,
      errorMessage: d.errorMessage?.slice(0, 80),
    })),
  );

  console.log('\n== JOBS EN LA QUEUE (campaign.send) ==');
  // Job status como string para no depender del enum generado
  const jobs = await prisma.$queryRaw`
    SELECT status, COUNT(*)::int AS count,
           MIN("nextRunAt") AS next_run_min,
           MAX("nextRunAt") AS next_run_max
    FROM "jobs"
    WHERE queue = 'campaign.send'
      AND payload->>'campaignId' = ${campaign.id}
    GROUP BY status
    ORDER BY status
  `;
  console.table(jobs);

  console.log('\n== TOKEN BALANCE DEL OWNER ==');
  if (campaign.ownerUserId) {
    const balance = await prisma.tokenBalance.findUnique({
      where: { userId: campaign.ownerUserId },
    });
    console.log(balance ?? '(sin registro de balance)');
  }

  console.log('\n== DEVICES ELIGIBLES ==');
  const devices = await prisma.device.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      fcmToken: true,
      lastHeartbeat: true,
    },
    orderBy: { lastHeartbeat: 'desc' },
  });
  console.table(
    devices.map((d) => ({
      id: d.id.slice(0, 8),
      name: d.name,
      status: d.status,
      hasFcm: Boolean(d.fcmToken),
      lastHeartbeat: d.lastHeartbeat?.toISOString().slice(11, 19) ?? '—',
    })),
  );

  console.log('\n== AUDIT EVENTS RECIENTES DE CAMPAÑA ==');
  const audits = await prisma.auditEvent.findMany({
    where: { targetType: 'campaign', targetId: campaign.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.table(
    audits.map((a) => ({
      at: a.createdAt.toISOString().slice(11, 19),
      type: a.eventType,
      metadata: JSON.stringify(a.metadata)?.slice(0, 100),
    })),
  );

  console.log('\n== NOW vs próximos jobs ==');
  const now = new Date();
  const upcoming = await prisma.$queryRaw`
    SELECT id, "nextRunAt", attempts, status
    FROM "jobs"
    WHERE queue = 'campaign.send'
      AND payload->>'campaignId' = ${campaign.id}
      AND status IN ('PENDING'::"JobStatus", 'RUNNING'::"JobStatus")
    ORDER BY "nextRunAt" ASC
    LIMIT 5
  `;
  console.log('Server NOW:', now.toISOString());
  console.table(upcoming);
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
