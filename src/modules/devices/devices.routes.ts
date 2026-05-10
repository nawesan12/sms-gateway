import type { FastifyInstance } from 'fastify';
import { DevicesService } from './devices.service.js';
import { DevicesController } from './devices.controller.js';
import {
  CreateDeviceBody,
  DeviceParamId,
  UpdateDeviceBody,
  type CreateDeviceBodyT,
  type DeviceParamIdT,
  type UpdateDeviceBodyT,
} from './devices.schemas.js';

export async function registerDevicesRoutes(app: FastifyInstance): Promise<void> {
  const service = new DevicesService(app.prisma, app.env.MASTER_ENCRYPTION_KEY_B64, app.log);
  const controller = new DevicesController(service);

  app.get(
    '/v1/devices',
    {
      preHandler: app.requireAdmin,
      schema: { tags: ['devices'], security: [{ bearerAuth: [] }, { bootstrapToken: [] }] },
    },
    controller.list,
  );

  app.post<{ Body: CreateDeviceBodyT }>(
    '/v1/devices',
    {
      preHandler: app.requireAdmin,
      schema: {
        body: CreateDeviceBody,
        tags: ['devices'],
        security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
      },
    },
    controller.create,
  );

  app.patch<{ Params: DeviceParamIdT; Body: UpdateDeviceBodyT }>(
    '/v1/devices/:id',
    {
      preHandler: app.requireAdmin,
      schema: {
        params: DeviceParamId,
        body: UpdateDeviceBody,
        tags: ['devices'],
        security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
      },
    },
    controller.update,
  );

  app.delete<{ Params: DeviceParamIdT }>(
    '/v1/devices/:id',
    {
      preHandler: app.requireAdmin,
      schema: {
        params: DeviceParamId,
        tags: ['devices'],
        security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
      },
    },
    controller.remove,
  );
}
