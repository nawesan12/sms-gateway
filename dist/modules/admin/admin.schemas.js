import { Type } from '@sinclair/typebox';
export const ListSmsQuery = Type.Object({
    status: Type.Optional(Type.Union([
        Type.Literal('PENDING'),
        Type.Literal('SENT'),
        Type.Literal('DELIVERED'),
        Type.Literal('FAILED'),
        Type.Literal('RETRYING'),
    ])),
    deviceId: Type.Optional(Type.String({ format: 'uuid' })),
    from: Type.Optional(Type.String({ format: 'date-time' })),
    to: Type.Optional(Type.String({ format: 'date-time' })),
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
});
export const ListOtpQuery = Type.Object({
    phone: Type.Optional(Type.String()),
    from: Type.Optional(Type.String({ format: 'date-time' })),
    to: Type.Optional(Type.String({ format: 'date-time' })),
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
});
