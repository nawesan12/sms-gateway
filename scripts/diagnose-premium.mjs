import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const list = await prisma.contactList.findFirst({
  where: { name: { contains: 'remium', mode: 'insensitive' } },
});
if (!list) {
  console.log('No encontré lista premium');
  process.exit();
}
console.log('LISTA:', list.id, list.name);

const camps = await prisma.campaign.findMany({
  where: { listId: list.id },
  orderBy: { createdAt: 'desc' },
});
console.log('\n== TODAS LAS CAMPAÑAS DE PREMIUM ==');
console.table(
  camps.map((c) => ({
    id: c.id.slice(0, 8),
    name: c.name,
    status: c.status,
    sent: c.sentCount,
    failed: c.failedCount,
    total: c.totalRecipients,
    mph: c.messagesPerHour,
    launched: c.launchedAt?.toISOString().slice(5, 19) ?? '—',
    completed: c.completedAt?.toISOString().slice(5, 19) ?? '—',
  })),
);

for (const c of camps.filter((x) => x.launchedAt)) {
  console.log('\n== CAMPAÑA', c.name, c.id.slice(0, 8), '==');
  console.log('Template:', c.messageTemplate?.slice(0, 100));
  const ds = await prisma.campaignDelivery.findMany({
    where: { campaignId: c.id },
    include: { contact: { select: { phoneE164: true, name: true } } },
  });
  console.table(
    ds.map((d) => ({
      phone: d.contact.phoneE164,
      status: d.status,
      errorCode: d.errorCode,
      errorMessage: d.errorMessage?.slice(0, 60),
      sentAt: d.sentAt?.toISOString().slice(11, 19) ?? '—',
      smsId: d.smsMessageId?.slice(0, 8) ?? '—',
    })),
  );
  const smsIds = ds.filter((d) => d.smsMessageId).map((d) => d.smsMessageId);
  if (smsIds.length > 0) {
    const sms = await prisma.smsMessage.findMany({ where: { id: { in: smsIds } } });
    console.table(
      sms.map((s) => ({
        id: s.id.slice(0, 8),
        status: s.status,
        device: s.deviceId?.slice(0, 8),
        sentAt: s.sentAt?.toISOString().slice(11, 19) ?? '—',
        delivered: s.deliveredAt?.toISOString().slice(11, 19) ?? '—',
        failed: s.failedAt?.toISOString().slice(11, 19) ?? '—',
        retries: s.retryCount,
        error: s.errorMessage?.slice(0, 60),
      })),
    );
  }
}

console.log('\nServer NOW:', new Date().toISOString());

await prisma.$disconnect();
