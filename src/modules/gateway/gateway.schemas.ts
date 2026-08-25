import { Type, type Static } from '@sinclair/typebox';

export const GatewayDeviceParamId = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type GatewayDeviceParamIdT = Static<typeof GatewayDeviceParamId>;

// La app upstream manda PATCH /devices/:id con {fcmToken} cuando obtiene/refresca
// el token de Firebase. La app también manda muchos campos extra (enabled,
// brand, model, simInfo, etc.) que acá ignoramos pero NO podemos rechazar
// con 400: `additionalProperties: true` permite que pasen y el handler solo
// lee `fcmToken`. Sin esto, el toggle "device enabled" de la app rompe.
export const PatchDeviceBody = Type.Object(
  {
    fcmToken: Type.Optional(Type.String({ minLength: 10, maxLength: 4096 })),
  },
  { additionalProperties: true },
);
export type PatchDeviceBodyT = Static<typeof PatchDeviceBody>;

// Idem: la app puede mandar campos extra junto al batteryLevel, los ignoramos.
export const HeartbeatBody = Type.Object(
  {
    batteryLevel: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  },
  { additionalProperties: true },
);
export type HeartbeatBodyT = Static<typeof HeartbeatBody>;

export const SmsStatusBody = Type.Object(
  {
    // ID del SmsMessage tal como el server lo mandó en el data payload del FCM.
    smsId: Type.String({ format: 'uuid' }),
    // 'sent' = el celular pasó el SMS al carrier; 'delivered' = el carrier
    // confirmó entrega; 'failed' = error al enviar (sin señal, sin saldo, etc).
    // Aceptamos las versiones uppercase también porque la app Android setea
    // smsDTO.setStatus("SENT"/"DELIVERED"/"FAILED"/"DELIVERY_FAILED") y antes
    // tirábamos 400 silencioso. El handler normaliza a lowercase.
    status: Type.Union([
      Type.Literal('sent'),
      Type.Literal('delivered'),
      Type.Literal('failed'),
      Type.Literal('SENT'),
      Type.Literal('DELIVERED'),
      Type.Literal('FAILED'),
      Type.Literal('DELIVERY_FAILED'),
    ]),
    errorMessage: Type.Optional(Type.String({ maxLength: 500 })),
  },
  { additionalProperties: true },
);
export type SmsStatusBodyT = Static<typeof SmsStatusBody>;
