import crypto from 'node:crypto';
import { UserRole } from '@prisma/client';
import { validateAndNormalizePhone } from '@/lib/phone.js';
import { AppError } from '@/plugins/error-handler.js';
import { AUDIT_EVENTS, ERROR_CODES } from '@/config/constants.js';
import { AuditService } from '@/modules/audit/audit.service.js';
import { UserService } from '@/modules/users/user.service.js';
import { TokensService } from '@/modules/tokens/tokens.service.js';
export function hashAccessToken(plain) {
    return crypto.createHash('sha256').update(plain).digest('hex');
}
export function generateAccessToken() {
    return crypto.randomBytes(32).toString('base64url');
}
export class AccessTokenService {
    prisma;
    env;
    users;
    audit;
    tokens;
    constructor(prisma, env, logger) {
        this.prisma = prisma;
        this.env = env;
        this.users = new UserService(prisma);
        this.audit = new AuditService(prisma, logger);
        this.tokens = new TokensService(prisma, logger);
    }
    async createAccessLink(input) {
        const validation = validateAndNormalizePhone(input.rawPhone, this.env.DEFAULT_PHONE_REGION);
        if (!validation.valid) {
            throw new AppError(ERROR_CODES.INVALID_PHONE, 'Invalid phone number', 400);
        }
        const phoneE164 = validation.e164;
        const user = await this.users.getOrCreateByPhone(phoneE164);
        const desiredRole = input.role ?? UserRole.ADMIN;
        if (user.role !== desiredRole) {
            await this.prisma.user.update({
                where: { id: user.id },
                data: { role: desiredRole },
            });
        }
        const tokenPlain = generateAccessToken();
        const tokenHash = hashAccessToken(tokenPlain);
        const issuedAt = new Date();
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                accessTokenHash: tokenHash,
                accessTokenIssuedAt: issuedAt,
            },
        });
        const link = `${this.env.APP_BASE_URL.replace(/\/$/, '')}/login?token=${tokenPlain}`;
        // Top-up automático si se especifica saldo inicial.
        let balance = (await this.tokens.getBalance(user.id)).amount;
        if (input.initialTokens && input.initialTokens > 0) {
            const result = await this.tokens.topUp({
                userId: user.id,
                amount: input.initialTokens,
                reason: 'access_link.initial_topup',
                actorType: input.actorType ?? 'admin',
                actorId: input.actorId,
                correlationId: input.correlationId,
            });
            balance = result.balance;
        }
        await this.audit.record({
            eventType: AUDIT_EVENTS.ACCESS_TOKEN_ISSUED,
            actorType: input.actorType ?? 'admin',
            actorId: input.actorId ?? null,
            targetType: 'user',
            targetId: user.id,
            correlationId: input.correlationId ?? null,
            metadata: { phoneE164, role: desiredRole, initialTokens: input.initialTokens ?? 0 },
        });
        return { link, userId: user.id, phoneE164, issuedAt, balance };
    }
    async findUserByToken(plain) {
        if (!plain || typeof plain !== 'string' || plain.length < 16 || plain.length > 128) {
            return null;
        }
        const tokenHash = hashAccessToken(plain);
        const user = await this.prisma.user.findUnique({ where: { accessTokenHash: tokenHash } });
        if (!user)
            return null;
        if (user.isBlocked)
            return null;
        return user;
    }
}
