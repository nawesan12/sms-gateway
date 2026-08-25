import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const devices = await prisma.device.findMany({
  select: {
    id: true,
    name: true,
    status: true,
    fcmToken: true,
    lastHeartbeat: true,
    priority: true,
    apiKeyHash: true,
    createdAt: true,
  },
  orderBy: { name: 'asc' },
});

console.log('\n== DEVICES ==');
for (const d of devices) {
  console.log(`\n${d.name}`);
  console.log(`  deviceId : ${d.id}`);
  console.log(`  status   : ${d.status}`);
  console.log(`  hasFcm   : ${Boolean(d.fcmToken)}`);
  console.log(`  hasApiKey: ${Boolean(d.apiKeyHash)} (hash, no plaintext)`);
  console.log(`  priority : ${d.priority}`);
  console.log(`  lastHB   : ${d.lastHeartbeat?.toISOString() ?? '—'}`);
  console.log(`  created  : ${d.createdAt.toISOString().slice(0, 10)}`);
}

await prisma.$disconnect();
