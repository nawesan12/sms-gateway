import type { FastifyInstance } from 'fastify';
import { DevicesService } from '@/modules/devices/devices.service.js';
import { GatewayService } from './gateway.service.js';
import { GatewayController } from './gateway.controller.js';
import { buildGatewayAuth } from './gateway-auth.js';
import {
  GatewayDeviceParamId,
  HeartbeatBody,
  PatchDeviceBody,
  SmsStatusBody,
  type GatewayDeviceParamIdT,
  type HeartbeatBodyT,
  type PatchDeviceBodyT,
  type SmsStatusBodyT,
} from './gateway.schemas.js';

// Endpoints que consume EXCLUSIVAMENTE la app Android instalada en cada
// celular. Auth: header `x-api-key` matcheado contra Device.apiKeyHash.
export async function registerGatewayRoutes(app: FastifyInstance): Promise<void> {
  const devices = new DevicesService(app.prisma, app.env.MASTER_ENCRYPTION_KEY_B64, app.log);
  const service = new GatewayService(app.prisma, devices, app.log);
  const controller = new GatewayController(service);
  const gatewayAuth = buildGatewayAuth(devices);

  // PATCH /v1/gateway/devices/:id
  // La app upstream pega acá cuando obtiene/refresca el fcmToken de Firebase.
  app.patch<{ Params: GatewayDeviceParamIdT; Body: PatchDeviceBodyT }>(
    '/v1/gateway/devices/:id',
    {
      preHandler: gatewayAuth,
      schema: {
        params: GatewayDeviceParamId,
        body: PatchDeviceBody,
        tags: ['gateway'],
      },
    },
    controller.patchDevice,
  );

  // POST /v1/gateway/devices/:id/heartbeat
  app.post<{ Params: GatewayDeviceParamIdT; Body: HeartbeatBodyT }>(
    '/v1/gateway/devices/:id/heartbeat',
    {
      preHandler: gatewayAuth,
      schema: {
        params: GatewayDeviceParamId,
        body: HeartbeatBody,
        tags: ['gateway'],
      },
    },
    controller.heartbeat,
  );

  // PATCH /v1/gateway/devices/:id/sms-status
  app.patch<{ Params: GatewayDeviceParamIdT; Body: SmsStatusBodyT }>(
    '/v1/gateway/devices/:id/sms-status',
    {
      preHandler: gatewayAuth,
      schema: {
        params: GatewayDeviceParamId,
        body: SmsStatusBody,
        tags: ['gateway'],
      },
    },
    controller.smsStatus,
  );
}
