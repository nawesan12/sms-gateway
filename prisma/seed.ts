import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '+5491100000001';

  const existing = await prisma.user.findUnique({ where: { phoneE164: adminPhone } });
  if (existing) {
    if (existing.role !== UserRole.ADMIN) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: UserRole.ADMIN },
      });
      console.warn(`✓ Promoted ${adminPhone} to ADMIN`);
    } else {
      console.warn(`✓ Admin ${adminPhone} already present`);
    }
    return;
  }

  await prisma.user.create({
    data: {
      phoneE164: adminPhone,
      role: UserRole.ADMIN,
    },
  });
  console.warn(`✓ Created admin user ${adminPhone}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
