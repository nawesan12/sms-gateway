import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const tokens = await prisma.accessToken.findMany({
  where: { revokedAt: null },
  include: { user: { select: { phone: true, role: true } } },
  orderBy: { createdAt: 'desc' },
  take: 5,
});
console.log(JSON.stringify(tokens, null, 2));
await prisma.$disconnect();
