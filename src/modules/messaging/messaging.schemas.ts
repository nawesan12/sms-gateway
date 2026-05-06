import { Type, type Static } from '@sinclair/typebox';

export const SendSmsBody = Type.Object({
  phone: Type.String({ minLength: 1, maxLength: 32 }),
  message: Type.String({ minLength: 1, maxLength: 1600 }),
  contactId: Type.Optional(Type.String({ format: 'uuid' })),
});
export type SendSmsBodyT = Static<typeof SendSmsBody>;

export const SmsIdParam = Type.Object({
  id: Type.String({ format: 'uuid' }),
});
export type SmsIdParamT = Static<typeof SmsIdParam>;
