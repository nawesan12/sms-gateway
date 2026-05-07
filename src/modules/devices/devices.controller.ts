import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CreateDeviceBodyT, DeviceParamIdT, UpdateDeviceBodyT } from './devices.schemas.js';
import type { DevicesService } from './devices.service.js';

export class DevicesController {
  constructor(private readonly service: DevicesService) {}

  list = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const items = await this.service.list();
    reply.send({
      success: true,
      data: { items, total: items.length },
      error: null,
      meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
    });
  };

  create = async (
    req: FastifyRequest<{ Body: CreateDeviceBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const actorId = req.authUser?.id ?? 'unknown';
    const created = await this.service.create(req.body, actorId, req.correlationId);
    reply.code(201).send({
      success: true,
      data: created,
      error: null,
      meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
    });
  };

  update = async (
    req: FastifyRequest<{ Params: DeviceParamIdT; Body: UpdateDeviceBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const actorId = req.authUser?.id ?? 'unknown';
    const updated = await this.service.update(req.params.id, req.body, actorId, req.correlationId);
    reply.send({
      success: true,
      data: updated,
      error: null,
      meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
    });
  };

  remove = async (
    req: FastifyRequest<{ Params: DeviceParamIdT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const actorId = req.authUser?.id ?? 'unknown';
    await this.service.remove(req.params.id, actorId, req.correlationId);
    reply.code(204).send();
  };
}
