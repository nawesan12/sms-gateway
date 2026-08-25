import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Device } from '@prisma/client';
import type {
  GatewayDeviceParamIdT,
  HeartbeatBodyT,
  PatchDeviceBodyT,
  SmsStatusBodyT,
} from './gateway.schemas.js';
import type { GatewayService } from './gateway.service.js';

// El plugin gatewayAuth decora request.gatewayDevice cuando el header
// x-api-key matchea contra apiKeyHash.
type AuthedRequest<T = unknown> = FastifyRequest<T extends object ? T : never> & {
  gatewayDevice: Device;
};

function ok(): { success: true } {
  return { success: true };
}

export class GatewayController {
  constructor(private readonly service: GatewayService) {}

  patchDevice = async (
    req: FastifyRequest<{ Params: GatewayDeviceParamIdT; Body: PatchDeviceBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const r = req as AuthedRequest<{ Params: GatewayDeviceParamIdT; Body: PatchDeviceBodyT }>;
    if (r.gatewayDevice.id !== req.params.id) {
      reply.code(403).send({ success: false, error: 'apiKey does not match deviceId' });
      return;
    }
    if (req.body.fcmToken) {
      await this.service.registerFcmToken(r.gatewayDevice.id, req.body.fcmToken);
    }
    reply.send(ok());
  };

  heartbeat = async (
    req: FastifyRequest<{ Params: GatewayDeviceParamIdT; Body: HeartbeatBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const r = req as AuthedRequest<{ Params: GatewayDeviceParamIdT; Body: HeartbeatBodyT }>;
    if (r.gatewayDevice.id !== req.params.id) {
      reply.code(403).send({ success: false, error: 'apiKey does not match deviceId' });
      return;
    }
    // La app Android usa `batteryPercentage`, este endpoint históricamente
    // esperó `batteryLevel`. Aceptamos cualquiera de los dos para no perder
    // info del nivel de batería en los heartbeats reales.
    const body = req.body as { batteryLevel?: number; batteryPercentage?: number };
    const battery = body.batteryLevel ?? body.batteryPercentage ?? null;
    await this.service.heartbeat(r.gatewayDevice.id, battery);
    reply.send(ok());
  };

  smsStatus = async (
    req: FastifyRequest<{ Params: GatewayDeviceParamIdT; Body: SmsStatusBodyT }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const r = req as AuthedRequest<{ Params: GatewayDeviceParamIdT; Body: SmsStatusBodyT }>;
    if (r.gatewayDevice.id !== req.params.id) {
      reply.code(403).send({ success: false, error: 'apiKey does not match deviceId' });
      return;
    }
    await this.service.reportSmsStatus(r.gatewayDevice.id, req.body);
    reply.send(ok());
  };
}
