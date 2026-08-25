import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const campaign = await prisma.campaign.findFirst({
  orderBy: { launchedAt: 'desc' },
  include: { list: { select: { name: true } } },
});

console.log('\n== ÚLTIMA CAMPAÑA ==');
console.log({
  id: campaign.id,
  name: campaign.name,
  list: campaign.list.name,
  status: campaign.status,
  template: campaign.messageTemplate?.slice(0, 80),
  totalRecipients: campaign.totalRecipients,
  sentCount: campaign.sentCount,
  failedCount: campaign.failedCount,
  messagesPerHour: campaign.messagesPerHour,
  launchedAt: campaign.launchedAt,
  completedAt: campaign.completedAt,
});

const deliveries = await prisma.campaignDelivery.findMany({
  where: { campaignId: campaign.id },
  include: { contact: { select: { phoneE164: true, name: true } } },
});

console.log('\n== DELIVERIES ==');
console.table(
  deliveries.map((d) => ({
    phone: d.contact.phoneE164,
    name: d.contact.name,
    status: d.status,
    errorCode: d.errorCode,
    errorMessage: d.errorMessage?.slice(0, 80),
    sentAt: d.sentAt?.toISOString().slice(11, 19) ?? '—',
    smsMessageId: d.smsMessageId?.slice(0, 8) ?? '—',
  })),
);

console.log('\n== SMS MESSAGES de la campaña ==');
const smsIds = deliveries.filter((d) => d.smsMessageId).map((d) => d.smsMessageId);
if (smsIds.length > 0) {
  const sms = await prisma.smsMessage.findMany({
    where: { id: { in: smsIds } },
    select: {
      id: true,
      status: true,
      deviceId: true,
      sentAt: true,
      deliveredAt: true,
      failedAt: true,
      errorCode: true,
      errorMessage: true,
      retryCount: true,
    },
  });
  console.table(
    sms.map((s) => ({
      id: s.id.slice(0, 8),
      status: s.status,
      device: s.deviceId?.slice(0, 8),
      sentAt: s.sentAt?.toISOString().slice(11, 19) ?? '—',
      delivered: s.deliveredAt?.toISOString().slice(11, 19) ?? '—',
      failed: s.failedAt?.toISOString().slice(11, 19) ?? '—',
      error: s.errorMessage?.slice(0, 60),
    })),
  );
}

console.log('\n== DEVICES ==');
const devices = await prisma.device.findMany({
  select: {
    id: true,
    name: true,
    status: true,
    fcmToken: true,
    lastHeartbeat: true,
    failureCount: true,
    circuitState: true,
  },
});
console.table(
  devices.map((d) => ({
    id: d.id.slice(0, 8),
    name: d.name,
    status: d.status,
    hasFcm: Boolean(d.fcmToken),
    lastHeartbeat: d.lastHeartbeat?.toISOString().slice(5, 19) ?? '—',
    circuit: d.circuitState,
    failures: d.failureCount,
  })),
);

console.log('\nServer NOW:', new Date().toISOString());

console.log('\n== JOBS EN QUEUE de esta campaña ==');
const jobs = await prisma.$queryRaw`
  SELECT status, COUNT(*)::int as count
  FROM "jobs"
  WHERE queue = 'campaign.send'
    AND payload->>'campaignId' = ${campaign.id}
  GROUP BY status
`;
console.table(jobs);

await prisma.$disconnect();
