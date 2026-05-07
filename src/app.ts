import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { buildLoggerOptions } from './plugins/logger.js';
import envPlugin from './plugins/env-plugin.js';
import prismaPlugin from './plugins/prisma.js';
import redisPlugin from './plugins/redis.js';
import correlationIdPlugin from './plugins/correlation-id.js';
import errorHandler from './plugins/error-handler.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import authJwt from './plugins/auth-jwt.js';
import authAdmin from './plugins/auth-admin.js';
import authOperator from './plugins/auth-operator.js';
import metricsPlugin from './plugins/metrics.js';
import swaggerPlugin from './plugins/swagger.js';
import staticWebPlugin from './plugins/static-web.js';
import { registerDevicesRoutes } from './modules/devices/devices.routes.js';
import { registerAdminRoutes } from './modules/admin/admin.routes.js';
import { registerHealthRoutes } from './modules/health/health.routes.js';
import { registerMessagingRoutes } from './modules/messaging/messaging.routes.js';
import { registerContactsRoutes } from './modules/contacts/contacts.routes.js';
import { registerContactListsRoutes } from './modules/contact-lists/contact-lists.routes.js';
import { registerCampaignsRoutes } from './modules/campaigns/campaigns.routes.js';
import { registerTokensRoutes } from './modules/tokens/tokens.routes.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { loadEnv } from './config/env.js';

export async function buildApp(): Promise<FastifyInstance> {
  const env = loadEnv();

  const app = Fastify({
    logger: buildLoggerOptions(env),
    trustProxy: true,
    bodyLimit: 1024 * 1024,
    disableRequestLogging: false,
  });

  await app.register(envPlugin);
  await app.register(sensible);
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        styleSrcElem: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  });
  await app.register(cors, {
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
    credentials: true,
  });
  await app.register(correlationIdPlugin);
  await app.register(errorHandler);
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(rateLimitPlugin);
  await app.register(authJwt);
  await app.register(authAdmin);
  await app.register(authOperator);
  await app.register(metricsPlugin);
  await app.register(swaggerPlugin);

  await app.register(async (instance) => {
    await registerHealthRoutes(instance);
    await registerAuthRoutes(instance);
    await registerMessagingRoutes(instance);
    await registerContactsRoutes(instance);
    await registerContactListsRoutes(instance);
    await registerCampaignsRoutes(instance);
    await registerDevicesRoutes(instance);
    await registerAdminRoutes(instance);
    await registerTokensRoutes(instance);
  });

  // Static web UI (al final para que el SPA fallback no tape rutas API)
  await app.register(staticWebPlugin);

  await app.ready();
  return app;
}
