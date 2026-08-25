// Lista users existentes y emite un access token nuevo para el primer ADMIN.
// Si no hay ADMIN, lista todos los users para que elijas.
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generatePlain() {
  return crypto.randomBytes(32).toString('hex');
}
function hashToken(t) {
  return crypto.createHash('sha256').update(t).digest('hex');
}

const admins = await prisma.user.findMany({
  where: { role: 'ADMIN', isBlocked: false },
  orderBy: { lastLoginAt: 'desc' },
});

if (admins.length === 0) {
  const all = await prisma.user.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
  console.log('NO HAY ADMINS. Users existentes:');
  console.table(all.map((u) => ({ id: u.id.slice(0, 8), phone: u.phoneE164, role: u.role })));
  process.exit(1);
}

const target = admins[0];
const tokenPlain = generatePlain();
const tokenHash = hashToken(tokenPlain);

await prisma.user.update({
  where: { id: target.id },
  data: { accessTokenHash: tokenHash, accessTokenIssuedAt: new Date() },
});

console.log('TOKEN_PLAIN=' + tokenPlain);
console.log('USER=' + target.phoneE164);
console.log('USER_ID=' + target.id);
await prisma.$disconnect();
