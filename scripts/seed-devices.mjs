// Crea N devices nuevos. Replica DevicesService.create: genera apiKey en
// plaintext (32 bytes base64url), guarda solo el hash HMAC-SHA256 con
// MASTER_ENCRYPTION_KEY_B64. La apiKey en claro se imprime una sola vez.
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const NAMES = ['celu-3', 'celu-4', 'celu-5', 'celu-6'];
const PRIORITY = 100;

const masterKeyB64 = process.env.MASTER_ENCRYPTION_KEY_B64;
if (!masterKeyB64) {
  console.error('Falta MASTER_ENCRYPTION_KEY_B64 en el env');
  process.exit(1);
}

function generateApiKey() {
  return crypto.randomBytes(32).toString('base64url');
}
function hashApiKey(plain) {
  const key = Buffer.from(masterKeyB64, 'base64');
  return crypto.createHmac('sha256', key).update(plain).digest('hex');
}

const prisma = new PrismaClient();
const results = [];

for (const name of NAMES) {
  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  const created = await prisma.device.create({
    data: {
      name,
      textbeeDeviceId: crypto.randomUUID(),
      apiKeyHash,
      priority: PRIORITY,
    },
  });
  const updated = await prisma.device.update({
    where: { id: created.id },
    data: { textbeeDeviceId: created.id },
  });

  results.push({ name: updated.name, deviceId: updated.id, apiKey });
}

console.log('\n== DEVICES CREADOS (apiKey solo se ve UNA vez) ==');
for (const r of results) {
  console.log(`\n${r.name}`);
  console.log(`  deviceId : ${r.deviceId}`);
  console.log(`  apiKey   : ${r.apiKey}`);
}

await prisma.$disconnect();
