import type { FastifyReply, FastifyRequest } from 'fastify';
import type { TokenTransactionType } from '@prisma/client';
import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';
import type { TokensService } from './tokens.service.js';
import type {
  ListClientsQueryT,
  ListTransactionsQueryT,
  TopUpBodyT,
  UserIdParamT,
} from './tokens.schemas.js';

export class TokensController {
  constructor(private readonly service: TokensService) {}

  // OPERATOR: top-up para un cliente específico
  topUpForUser = async (
    req: FastifyRequest<{ Params: UserIdParamT; Body: TopUpBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
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
  balanceForUser = async (
    req: FastifyRequest<{ Params: UserIdParamT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.getBalance(req.params.userId);
    reply.send({
      success: true,
      data: out,
      error: null,
      meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
    });
  };

  // OPERATOR: historial de transacciones de un cliente específico
  listTransactionsForUser = async (
    req: FastifyRequest<{ Params: UserIdParamT; Querystring: ListTransactionsQueryT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.service.listTransactions({
      userId: req.params.userId,
      page: req.query.page ?? 1,
      pageSize: req.query.pageSize ?? 50,
      type: req.query.type as TokenTransactionType | undefined,
    });
    reply.send({
      success: true,
      data: out,
      error: null,
      meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
    });
  };

  // OPERATOR: listado de todos los clientes con balance
  listClients = async (
    req: FastifyRequest<{ Querystring: ListClientsQueryT }>,
    reply: FastifyReply,
  ): Promise<void> => {
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
  myBalance = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
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
