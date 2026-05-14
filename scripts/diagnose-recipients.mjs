#!/usr/bin/env node
// Read-only: analiza los destinatarios y el template de una campaña.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const campaignId = process.argv[2];
if (!campaignId) {
  console.error('Uso: node scripts/diagnose-recipients.mjs <campaignId>');
  process.exit(1);
}

async function main() {
  const c = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!c) {
    console.log('Campaña no encontrada');
    return;
  }

  console.log('\n== TEMPLATE ==');
  console.log(c.messageTemplate);

  console.log('\n== DESTINATARIOS — ÚNICOS vs DUPLICADOS ==');
  const counts = await prisma.$queryRaw`
    SELECT c."phoneE164", COUNT(*)::int AS cnt
    FROM "campaign_deliveries" d
    INNER JOIN "contacts" c ON c.id = d."contactId"
    WHERE d."campaignId" = ${campaignId}
    GROUP BY c."phoneE164"
    ORDER BY cnt DESC, c."phoneE164"
    LIMIT 20
  `;
  console.table(counts);

  const total = await prisma.$queryRaw`
    SELECT
      COUNT(DISTINCT c."phoneE164")::int AS unique_numbers,
      COUNT(*)::int AS total_deliveries
    FROM "campaign_deliveries" d
    INNER JOIN "contacts" c ON c.id = d."contactId"
    WHERE d."campaignId" = ${campaignId}
  `;
  console.table(total);

  console.log('\n== PREFIJOS / FORMATOS (top 10) ==');
  const prefixes = await prisma.$queryRaw`
    SELECT SUBSTRING(c."phoneE164", 1, 6) AS prefix, COUNT(*)::int AS cnt
    FROM "campaign_deliveries" d
    INNER JOIN "contacts" c ON c.id = d."contactId"
    WHERE d."campaignId" = ${campaignId}
    GROUP BY SUBSTRING(c."phoneE164", 1, 6)
    ORDER BY cnt DESC
    LIMIT 10
  `;
  console.table(prefixes);
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
