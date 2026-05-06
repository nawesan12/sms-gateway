import fp from 'fastify-plugin';
import staticPlugin from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

/**
 * Sirve el bundle estático del panel web (web/dist) desde el backend.
 * - GET /              → index.html
 * - GET /assets/*      → estáticos con cache largo
 * - SPA fallback: cualquier path no-API devuelve index.html para que
 *   React Router maneje la ruta client-side.
 */
export default fp(
  async (app) => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // src/plugins/static-web.ts → workspace root → web/dist
    const candidates = [
      path.resolve(here, '../../web/dist'),
      path.resolve(here, '../../../web/dist'),
      path.resolve(process.cwd(), 'web/dist'),
    ];
    let webDist: string | null = null;
    for (const c of candidates) {
      try {
        await fs.access(path.join(c, 'index.html'));
        webDist = c;
        break;
      } catch {
        /* not present */
      }
    }
    if (!webDist) {
      app.log.warn(
        { tried: candidates },
        'web/dist not found — UI will not be served. Run `npm --prefix web run build`',
      );
      return;
    }

    await app.register(staticPlugin, {
      root: webDist,
      prefix: '/',
      decorateReply: false,
      cacheControl: true,
      maxAge: '1d',
    });

    const indexHtml = await fs.readFile(path.join(webDist, 'index.html'), 'utf8');

    // SPA fallback: GETs no-API que no matchearon una ruta concreta → index.html
    app.setNotFoundHandler(async (req, reply) => {
      const url = req.raw.url ?? '/';
      const isApi =
        url.startsWith('/v1/') ||
        url.startsWith('/health') ||
        url.startsWith('/metrics') ||
        url.startsWith('/docs');
      if (req.method !== 'GET' || isApi) {
        reply.code(404).send({
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: 'Resource not found' },
          meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
        return;
      }
      reply.type('text/html').send(indexHtml);
    });

    app.log.info({ webDist }, 'serving web UI from disk');
  },
  { name: 'static-web', dependencies: ['error-handler'] },
);
