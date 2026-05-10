import fp from 'fastify-plugin';
import { loadEnv } from '../config/env.js';
export default fp(async (app) => {
    const env = loadEnv();
    app.decorate('env', env);
}, { name: 'env' });
