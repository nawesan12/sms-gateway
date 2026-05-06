import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export default fp(
  async (app) => {
    await app.register(swagger, {
      openapi: {
        openapi: '3.1.0',
        info: {
          title: 'SMS Gateway API',
          description: 'OTP via SMS sobre Android+TextBee',
          version: '0.1.0',
        },
        servers: [{ url: `http://localhost:${app.env.PORT}` }],
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            bootstrapToken: {
              type: 'apiKey',
              in: 'header',
              name: 'x-bootstrap-token',
              description: 'One-shot bootstrap token (only for first admin/device).',
            },
          },
        },
      },
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: false },
    });
  },
  { name: 'swagger', dependencies: ['env'] },
);
