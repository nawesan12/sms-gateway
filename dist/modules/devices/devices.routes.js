import { DeviceCrypto } from './crypto.js';
import { DevicesService } from './devices.service.js';
import { DevicesController } from './devices.controller.js';
import { CreateDeviceBody, DeviceParamId, UpdateDeviceBody, } from './devices.schemas.js';
export async function registerDevicesRoutes(app) {
    const crypto = new DeviceCrypto(app.env.MASTER_ENCRYPTION_KEY_B64);
    const service = new DevicesService(app.prisma, crypto, app.log);
    const controller = new DevicesController(service);
    app.get('/v1/devices', {
        preHandler: app.requireAdmin,
        schema: { tags: ['devices'], security: [{ bearerAuth: [] }, { bootstrapToken: [] }] },
    }, controller.list);
    app.post('/v1/devices', {
        preHandler: app.requireAdmin,
        schema: {
            body: CreateDeviceBody,
            tags: ['devices'],
            security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
        },
    }, controller.create);
    app.patch('/v1/devices/:id', {
        preHandler: app.requireAdmin,
        schema: {
            params: DeviceParamId,
            body: UpdateDeviceBody,
            tags: ['devices'],
            security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
        },
    }, controller.update);
    app.delete('/v1/devices/:id', {
        preHandler: app.requireAdmin,
        schema: {
            params: DeviceParamId,
            tags: ['devices'],
            security: [{ bearerAuth: [] }, { bootstrapToken: [] }],
        },
    }, controller.remove);
}
