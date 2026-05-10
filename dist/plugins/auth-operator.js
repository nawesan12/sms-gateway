import fp from 'fastify-plugin';
import { AppError } from './error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';
export default fp(async (app) => {
    // Operator = quien tiene el ADMIN_BOOTSTRAP_TOKEN (vos, el que opera la plataforma).
    // No acepta access tokens estáticos de clientes.
    app.decorate('requireOperator', async (req) => {
        const bootstrap = req.headers['x-bootstrap-token'];
        if (typeof bootstrap === 'string' && bootstrap === app.env.ADMIN_BOOTSTRAP_TOKEN) {
            req.authUser = { id: 'bootstrap', phoneE164: 'bootstrap', role: 'ADMIN' };
            return;
        }
        throw new AppError(ERROR_CODES.FORBIDDEN, 'Operator role required', 403);
    });
}, { name: 'auth-operator', dependencies: ['env'] });
