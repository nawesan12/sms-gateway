import fp from 'fastify-plugin';
import { ulid } from 'ulid';

const HEADER = 'x-request-id';

export default fp(
  async (app) => {
    app.decorateRequest('correlationId', '');

    app.addHook('onRequest', async (req, reply) => {
      const incoming = req.headers[HEADER];
      const id =
        typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 64
          ? incoming
          : ulid();
      req.correlationId = id;
      reply.header(HEADER, id);
    });

    app.addHook('preHandler', async (req) => {
      req.log = req.log.child({ correlationId: req.correlationId });
    });
  },
  { name: 'correlation-id' },
);
