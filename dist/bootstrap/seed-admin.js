import { UserRole } from '@prisma/client';
// Idempotente: corre en cada boot. Si la DB ya tiene el admin, no toca nada.
// Si existe pero con otro rol, lo promueve. Si no existe, lo crea.
// Pensado para Render free, donde el Shell del service no está disponible
// y `npm run prisma:seed` no se puede correr a mano.
export async function seedAdminIfMissing({ prisma, phoneE164, logger, }) {
    try {
        const existing = await prisma.user.findUnique({ where: { phoneE164 } });
        if (!existing) {
            await prisma.user.create({
                data: { phoneE164, role: UserRole.ADMIN },
            });
            logger.info({ phoneE164 }, 'auto-seed: admin user created');
            return;
        }
        if (existing.role !== UserRole.ADMIN) {
            await prisma.user.update({
                where: { id: existing.id },
                data: { role: UserRole.ADMIN },
            });
            logger.info({ phoneE164 }, 'auto-seed: existing user promoted to ADMIN');
            return;
        }
        logger.debug({ phoneE164 }, 'auto-seed: admin already present');
    }
    catch (err) {
        // No matamos el boot si el seed falla — la API levanta igual y el
        // operador puede crear el admin a mano via /v1/admin/users.
        logger.warn({ err }, 'auto-seed: failed (non-fatal, continuing boot)');
    }
}
