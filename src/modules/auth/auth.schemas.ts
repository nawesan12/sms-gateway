import { Type, type Static } from '@sinclair/typebox';

export const SendCodeBody = Type.Object({
  phone: Type.String({ minLength: 1, maxLength: 32, description: 'E.164 or local format' }),
});
export type SendCodeBodyT = Static<typeof SendCodeBody>;

export const SendCodeResponse = Type.Object({
  success: Type.Literal(true),
  data: Type.Object({
    requestId: Type.String(),
    expiresInSec: Type.Integer(),
    cooldownSec: Type.Integer(),
    phoneMasked: Type.String(),
  }),
  error: Type.Null(),
  meta: Type.Object({ requestId: Type.String(), timestamp: Type.String() }),
});

export const VerifyCodeBody = Type.Object({
  phone: Type.String({ minLength: 1, maxLength: 32 }),
  code: Type.String({ minLength: 4, maxLength: 10, pattern: '^[0-9]{4,10}$' }),
});
export type VerifyCodeBodyT = Static<typeof VerifyCodeBody>;

export const VerifyCodeResponse = Type.Object({
  success: Type.Literal(true),
  data: Type.Object({
    user: Type.Object({
      id: Type.String(),
      phoneE164: Type.String(),
      role: Type.String(),
    }),
    accessToken: Type.String(),
    refreshToken: Type.String(),
  }),
  error: Type.Null(),
  meta: Type.Object({ requestId: Type.String(), timestamp: Type.String() }),
});

export const ErrorResponse = Type.Object({
  success: Type.Literal(false),
  data: Type.Null(),
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    details: Type.Optional(Type.Unknown()),
  }),
  meta: Type.Object({ requestId: Type.String(), timestamp: Type.String() }),
});

export const CreateAccessLinkBody = Type.Object({
  phoneE164: Type.String({ minLength: 1, maxLength: 32 }),
  role: Type.Optional(Type.Union([Type.Literal('ADMIN'), Type.Literal('USER')])),
  initialTokens: Type.Optional(Type.Integer({ minimum: 0, maximum: 1_000_000 })),
});
export type CreateAccessLinkBodyT = Static<typeof CreateAccessLinkBody>;
