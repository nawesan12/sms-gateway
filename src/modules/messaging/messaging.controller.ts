import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';
import type { MessagingService } from './messaging.service.js';
import type { SendSmsBodyT, SmsIdParamT } from './messaging.schemas.js';

export class MessagingController {
  constructor(private readonly service: MessagingService) {}

  send = async (
    req: FastifyRequest<{ Body: SendSmsBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!req.authUser || req.authUser.id === 'bootstrap') {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        'Send requires a client access token (operator bootstrap cannot send SMS to avoid debiting unidentified accounts)',
        403,
      );
    }
    const out = await this.service.sendOne({
      rawPhone: req.body.phone,
      message: req.body.message,
      contactId: req.body.contactId ?? null,
      ownerUserId: req.authUser.id,
      correlationId: req.correlationId,
    });
    reply.code(202).send({
      success: true,
      data: out,
      error: null,
      meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
    });
  };

  status = async (
    req: FastifyRequest<{ Params: SmsIdParamT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const sms = await this.service.getSmsStatus(req.params.id);
    reply.send({
      success: true,
      data: sms,
      error: null,
      meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
    });
  };
}
