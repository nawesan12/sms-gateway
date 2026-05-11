import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

// Store en memoria nativo de @fastify/rate-limit. Aceptable para un único
// proceso Node (los contadores se reinician en deploy, pero la ventana de IP
// es corta y los abusers tendrían que coordinar con nuestros restarts).
export default fp(
  async (app) => {
    await app.register(rateLimit, {
      global: false,
      keyGenerator: (req) => req.ip,
    });
  },
  { name: 'rate-limit', dependencies: ['env'] },
);
