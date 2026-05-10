import { Type, type Static } from '@sinclair/typebox';

// Eventos que emite el upstream (TextBee OSS, módulo api/src/webhook/).
// Mapeo:
//   MESSAGE_SENT      → ya seteamos optimistically al postear; actualizar sentAt si falta.
//   MESSAGE_DELIVERED → SmsMessage.status = DELIVERED, deliveredAt = now.
//   MESSAGE_FAILED    → SmsMessage.status = FAILED, failedAt = now, errorCode/Message.
//   MESSAGE_RECEIVED  → no aplica (recepción de SMS entrantes, no la usamos).
export const WebhookSmsStatusBody = Type.Object({
  webhookEvent: Type.Union([
    Type.Literal('MESSAGE_SENT'),
    Type.Literal('MESSAGE_DELIVERED'),
    Type.Literal('MESSAGE_FAILED'),
    Type.Literal('MESSAGE_RECEIVED'),
  ]),
  idempotencyKey: Type.String({ minLength: 1, maxLength: 128 }),
  smsId: Type.Optional(Type.String()),
  smsBatchId: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  recipient: Type.Optional(Type.String()),
  message: Type.Optional(Type.String()),
  deviceId: Type.Optional(Type.String()),
  webhookSubscriptionId: Type.Optional(Type.String()),
  sentAt: Type.Optional(Type.String()),
  deliveredAt: Type.Optional(Type.String()),
  failedAt: Type.Optional(Type.String()),
  errorMessage: Type.Optional(Type.String()),
});
export type WebhookSmsStatusBodyT = Static<typeof WebhookSmsStatusBody>;
