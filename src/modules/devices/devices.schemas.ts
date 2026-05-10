import { Type, type Static } from '@sinclair/typebox';

export const DeviceParamId = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type DeviceParamIdT = Static<typeof DeviceParamId>;

export const CreateDeviceBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  textbeeDeviceId: Type.String({ minLength: 1, maxLength: 100 }),
  apiKey: Type.String({ minLength: 8, maxLength: 256 }),
  priority: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
});
export type CreateDeviceBodyT = Static<typeof CreateDeviceBody>;

export const UpdateDeviceBody = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  priority: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
  status: Type.Optional(
    Type.Union([Type.Literal('ACTIVE'), Type.Literal('INACTIVE'), Type.Literal('OFFLINE')]),
  ),
  minDelayBetweenMs: Type.Optional(Type.Integer({ minimum: 0, maximum: 600_000 })),
});
export type UpdateDeviceBodyT = Static<typeof UpdateDeviceBody>;

export const DevicePublic = Type.Object({
  id: Type.String(),
  name: Type.String(),
  textbeeDeviceId: Type.String(),
  priority: Type.Integer(),
  status: Type.String(),
  batteryLevel: Type.Union([Type.Integer(), Type.Null()]),
  lastHeartbeat: Type.Union([Type.String(), Type.Null()]),
  failureCount: Type.Integer(),
  circuitState: Type.String(),
  minDelayBetweenMs: Type.Integer(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});
