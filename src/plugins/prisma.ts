import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

export default fp(
  async (app) => {
    const prisma = new PrismaClient({
      log: app.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
    await prisma.$connect();
    app.decorate('prisma', prisma);
    app.addHook('onClose', async () => {
      await prisma.$disconnect();
    });
  },
  { name: 'prisma', dependencies: ['env'] },
);
