import { TokenTransactionStatus, TokenTransactionType, } from '@prisma/client';
import { AuditService } from '../../modules/audit/audit.service.js';
import { AUDIT_EVENTS } from '../../config/constants.js';
import { TokensRepository } from './tokens.repository.js';
export class TokensService {
    prisma;
    logger;
    repo;
    audit;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.logger = logger;
        this.repo = new TokensRepository(prisma);
        this.audit = new AuditService(prisma, logger);
    }
    async reserve(input) {
        const result = await this.repo.tryReserve(input.userId, input.amount);
        if (!result.ok) {
            await this.audit.record({
                eventType: AUDIT_EVENTS.TOKEN_INSUFFICIENT,
                actorType: 'system',
                actorId: input.userId,
                targetType: 'sms_message',
                targetId: input.smsMessageId,
                correlationId: input.correlationId ?? null,
                metadata: {
                    userId: input.userId,
                    balance: result.balance,
                    required: input.amount,
                    reason: input.reason ?? null,
                },
            });
            return { ok: false, balance: result.balance, required: input.amount };
        }
        const tx = await this.prisma.tokenTransaction.create({
            data: {
                userId: input.userId,
                type: TokenTransactionType.RESERVATION,
                status: TokenTransactionStatus.RESERVED,
                amount: input.amount,
                balanceAfter: result.balanceAfter,
                smsMessageId: input.smsMessageId,
                reason: input.reason ?? null,
                actorType: 'system',
                correlationId: input.correlationId ?? null,
            },
        });
        await this.audit.record({
            eventType: AUDIT_EVENTS.TOKEN_RESERVED,
            actorType: 'system',
            actorId: input.userId,
            targetType: 'sms_message',
            targetId: input.smsMessageId,
            correlationId: input.correlationId ?? null,
            metadata: {
                userId: input.userId,
                amount: input.amount,
                balanceAfter: result.balanceAfter,
                transactionId: tx.id,
            },
        });
        return { ok: true, transactionId: tx.id, balanceAfter: result.balanceAfter };
    }
    async commit(transactionId) {
        const updated = await this.prisma.tokenTransaction.updateMany({
            where: {
                id: transactionId,
                type: TokenTransactionType.RESERVATION,
                status: TokenTransactionStatus.RESERVED,
            },
            data: { status: TokenTransactionStatus.COMMITTED },
        });
        if (updated.count === 0) {
            this.logger.debug({ transactionId }, 'token commit skipped (already terminal)');
            return false;
        }
        const tx = await this.prisma.tokenTransaction.findUnique({ where: { id: transactionId } });
        if (!tx)
            return false;
        const balance = await this.repo.getBalance(tx.userId);
        await this.prisma.tokenTransaction.create({
            data: {
                userId: tx.userId,
                type: TokenTransactionType.COMMIT,
                status: TokenTransactionStatus.COMMITTED,
                amount: 0,
                balanceAfter: balance.amount,
                smsMessageId: tx.smsMessageId,
                actorType: 'system',
                metadata: { reservationId: transactionId },
            },
        });
        await this.audit.record({
            eventType: AUDIT_EVENTS.TOKEN_COMMITTED,
            actorType: 'system',
            actorId: tx.userId,
            targetType: 'sms_message',
            targetId: tx.smsMessageId ?? null,
            correlationId: tx.correlationId ?? null,
            metadata: { userId: tx.userId, reservationId: transactionId, amount: tx.amount },
        });
        return true;
    }
    async refund(transactionId, reason) {
        const updated = await this.prisma.tokenTransaction.updateMany({
            where: {
                id: transactionId,
                type: TokenTransactionType.RESERVATION,
                status: TokenTransactionStatus.RESERVED,
            },
            data: { status: TokenTransactionStatus.REFUNDED },
        });
        if (updated.count === 0) {
            this.logger.debug({ transactionId }, 'token refund skipped (already terminal)');
            return false;
        }
        const tx = await this.prisma.tokenTransaction.findUnique({ where: { id: transactionId } });
        if (!tx)
            return false;
        const newBalance = await this.repo.addAmount(tx.userId, tx.amount);
        await this.prisma.tokenTransaction.create({
            data: {
                userId: tx.userId,
                type: TokenTransactionType.REFUND,
                status: TokenTransactionStatus.COMMITTED,
                amount: tx.amount,
                balanceAfter: newBalance,
                smsMessageId: tx.smsMessageId,
                actorType: 'system',
                reason,
                metadata: { reservationId: transactionId },
            },
        });
        await this.audit.record({
            eventType: AUDIT_EVENTS.TOKEN_REFUNDED,
            actorType: 'system',
            actorId: tx.userId,
            targetType: 'sms_message',
            targetId: tx.smsMessageId ?? null,
            correlationId: tx.correlationId ?? null,
            metadata: {
                userId: tx.userId,
                reservationId: transactionId,
                amount: tx.amount,
                balanceAfter: newBalance,
                reason,
            },
        });
        return true;
    }
    async topUp(input) {
        const newBalance = await this.repo.addAmount(input.userId, input.amount);
        const tx = await this.prisma.tokenTransaction.create({
            data: {
                userId: input.userId,
                type: TokenTransactionType.PURCHASE,
                status: TokenTransactionStatus.COMMITTED,
                amount: input.amount,
                balanceAfter: newBalance,
                actorType: input.actorType,
                actorId: input.actorId ?? null,
                reason: input.reason,
                correlationId: input.correlationId ?? null,
            },
        });
        await this.audit.record({
            eventType: AUDIT_EVENTS.TOKEN_TOPUP,
            actorType: input.actorType,
            actorId: input.actorId ?? null,
            targetType: 'user',
            targetId: input.userId,
            correlationId: input.correlationId ?? null,
            metadata: {
                userId: input.userId,
                amount: input.amount,
                balanceAfter: newBalance,
                reason: input.reason,
            },
        });
        return { balance: newBalance, transactionId: tx.id };
    }
    async getBalance(userId) {
        return this.repo.getBalance(userId);
    }
    async listTransactions(input) {
        const where = {
            userId: input.userId,
            ...(input.type ? { type: input.type } : {}),
        };
        const [items, total] = await Promise.all([
            this.prisma.tokenTransaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (input.page - 1) * input.pageSize,
                take: input.pageSize,
            }),
            this.prisma.tokenTransaction.count({ where }),
        ]);
        return { items, total, page: input.page, pageSize: input.pageSize };
    }
    async listClientsWithBalance(args) {
        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where: { accessTokenHash: { not: null } },
                orderBy: { createdAt: 'desc' },
                skip: (args.page - 1) * args.pageSize,
                take: args.pageSize,
                include: { tokenBalance: true },
            }),
            this.prisma.user.count({ where: { accessTokenHash: { not: null } } }),
        ]);
        const items = await Promise.all(users.map(async (u) => {
            const lastTopUp = await this.prisma.tokenTransaction.findFirst({
                where: { userId: u.id, type: TokenTransactionType.PURCHASE },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true },
            });
            return {
                userId: u.id,
                phoneE164: u.phoneE164,
                role: u.role,
                balance: u.tokenBalance?.amount ?? 0,
                lastTopUpAt: lastTopUp?.createdAt ?? null,
                accessTokenIssuedAt: u.accessTokenIssuedAt,
            };
        }));
        return { items, total, page: args.page, pageSize: args.pageSize };
    }
}
