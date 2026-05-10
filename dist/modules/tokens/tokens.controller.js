import { AppError } from '../../plugins/error-handler.js';
import { ERROR_CODES } from '../../config/constants.js';
export class TokensController {
    service;
    constructor(service) {
        this.service = service;
    }
    // OPERATOR: top-up para un cliente específico
    topUpForUser = async (req, reply) => {
        const out = await this.service.topUp({
            userId: req.params.userId,
            amount: req.body.amount,
            reason: req.body.reason,
            actorType: 'admin',
            actorId: req.authUser?.id,
            correlationId: req.correlationId,
        });
        reply.send({
            success: true,
            data: out,
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
    // OPERATOR: balance de un cliente específico
    balanceForUser = async (req, reply) => {
        const out = await this.service.getBalance(req.params.userId);
        reply.send({
            success: true,
            data: out,
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
    // OPERATOR: historial de transacciones de un cliente específico
    listTransactionsForUser = async (req, reply) => {
        const out = await this.service.listTransactions({
            userId: req.params.userId,
            page: req.query.page ?? 1,
            pageSize: req.query.pageSize ?? 50,
            type: req.query.type,
        });
        reply.send({
            success: true,
            data: out,
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
    // OPERATOR: listado de todos los clientes con balance
    listClients = async (req, reply) => {
        const out = await this.service.listClientsWithBalance({
            page: req.query.page ?? 1,
            pageSize: req.query.pageSize ?? 50,
        });
        reply.send({
            success: true,
            data: out,
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
    // CLIENT: balance del cliente autenticado (su propio saldo)
    myBalance = async (req, reply) => {
        if (!req.authUser || req.authUser.id === 'bootstrap') {
            throw new AppError(ERROR_CODES.FORBIDDEN, 'Client access required', 403);
        }
        const out = await this.service.getBalance(req.authUser.id);
        reply.send({
            success: true,
            data: out,
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
}
