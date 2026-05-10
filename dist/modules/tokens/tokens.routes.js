import { TokensService } from './tokens.service.js';
import { TokensController } from './tokens.controller.js';
import { ListClientsQuery, ListTransactionsQuery, TopUpBody, UserIdParam, } from './tokens.schemas.js';
export async function registerTokensRoutes(app) {
    const service = new TokensService(app.prisma, app.log);
    const controller = new TokensController(service);
    // ----- OPERATOR-only -----
    app.get('/v1/admin/users', {
        preHandler: app.requireOperator,
        schema: {
            querystring: ListClientsQuery,
            tags: ['operator', 'tokens'],
            security: [{ bootstrapToken: [] }],
        },
    }, controller.listClients);
    app.post('/v1/admin/users/:userId/tokens/top-up', {
        preHandler: app.requireOperator,
        schema: {
            params: UserIdParam,
            body: TopUpBody,
            tags: ['operator', 'tokens'],
            security: [{ bootstrapToken: [] }],
        },
    }, controller.topUpForUser);
    app.get('/v1/admin/users/:userId/tokens/balance', {
        preHandler: app.requireOperator,
        schema: {
            params: UserIdParam,
            tags: ['operator', 'tokens'],
            security: [{ bootstrapToken: [] }],
        },
    }, controller.balanceForUser);
    app.get('/v1/admin/users/:userId/tokens/transactions', {
        preHandler: app.requireOperator,
        schema: {
            params: UserIdParam,
            querystring: ListTransactionsQuery,
            tags: ['operator', 'tokens'],
            security: [{ bootstrapToken: [] }],
        },
    }, controller.listTransactionsForUser);
    // ----- Client-facing -----
    app.get('/v1/me/tokens/balance', {
        preHandler: app.requireAdmin,
        schema: {
            tags: ['client', 'tokens'],
            security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
        },
    }, controller.myBalance);
}
