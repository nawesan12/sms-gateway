import { Type, type Static } from '@sinclair/typebox';

export const GatewayDeviceParamId = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type GatewayDeviceParamIdT = Static<typeof GatewayDeviceParamId>;

// La app upstream manda PATCH /devices/:id con {fcmToken} cuando obtiene/refresca
// el token de Firebase. Otros campos (enabled, etc.) los ignoramos.
export const PatchDeviceBody = Type.Object({
  fcmToken: Type.Optional(Type.String({ minLength: 10, maxLength: 4096 })),
});
export type PatchDeviceBodyT = Static<typeof PatchDeviceBody>;

export const HeartbeatBody = Type.Object({
  batteryLevel: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
});
export type HeartbeatBodyT = Static<typeof HeartbeatBody>;

export const SmsStatusBody = Type.Object({
  // ID del SmsMessage tal como el server lo mandó en el data payload del FCM.
  smsId: Type.String({ format: 'uuid' }),
  // 'sent' = el celular pasó el SMS al carrier; 'delivered' = el carrier
  // confirmó entrega; 'failed' = error al enviar (sin señal, sin saldo, etc).
  status: Type.Union([Type.Literal('sent'), Type.Literal('delivered'), Type.Literal('failed')]),
  errorMessage: Type.Optional(Type.String({ maxLength: 500 })),
});
export type SmsStatusBodyT = Static<typeof SmsStatusBody>;
