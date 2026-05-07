import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService, SendCodeOutput, VerifyCodeOutput } from './auth.service.js';
import type { AccessTokenService } from './access-token.service.js';
import type { CreateAccessLinkBodyT, SendCodeBodyT, VerifyCodeBodyT } from './auth.schemas.js';

export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly accessTokens: AccessTokenService,
  ) {}

  sendCode = async (
    req: FastifyRequest<{ Body: SendCodeBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out: SendCodeOutput = await this.service.sendCode({
      rawPhone: req.body.phone,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      correlationId: req.correlationId,
    });
    reply.send({
      success: true,
      data: out,
      error: null,
      meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
    });
  };

  verifyCode = async (
    req: FastifyRequest<{ Body: VerifyCodeBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out: VerifyCodeOutput = await this.service.verifyCode({
      rawPhone: req.body.phone,
      code: req.body.code,
      ipAddress: req.ip ?? null,
      correlationId: req.correlationId,
    });
    reply.send({
      success: true,
      data: out,
      error: null,
      meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
    });
  };

  createAccessLink = async (
    req: FastifyRequest<{ Body: CreateAccessLinkBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const out = await this.accessTokens.createAccessLink({
      rawPhone: req.body.phoneE164,
      role: req.body.role ?? 'ADMIN',
      initialTokens: req.body.initialTokens,
      actorId: req.authUser?.id,
      actorType: 'admin',
      correlationId: req.correlationId,
    });
    reply.send({
      success: true,
      data: out,
      error: null,
      meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
    });
  };
}
