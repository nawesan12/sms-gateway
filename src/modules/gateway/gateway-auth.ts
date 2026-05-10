import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Device } from '@prisma/client';
import type { DevicesService } from '@/modules/devices/devices.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    gatewayDevice?: Device;
  }
}

// preHandler factory que autentica un request con header `x-api-key` contra
// Device.apiKeyHash y decora request.gatewayDevice con el device matcheado.
export function buildGatewayAuth(devices: DevicesService) {
  return async function gatewayAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = req.headers['x-api-key'];
    const apiKey = Array.isArray(header) ? header[0] : header;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 8) {
      reply.code(401).send({ success: false, error: 'missing x-api-key' });
      return;
    }
    const device = await devices.findByApiKey(apiKey);
    if (!device) {
      reply.code(401).send({ success: false, error: 'invalid x-api-key' });
      return;
    }
    req.gatewayDevice = device;
  };
}
