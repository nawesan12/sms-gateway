import { Type } from '@sinclair/typebox';
export const UserIdParam = Type.Object({
    userId: Type.String({ format: 'uuid' }),
});
export const TopUpBody = Type.Object({
    amount: Type.Integer({ minimum: 1, maximum: 1_000_000 }),
    reason: Type.String({ minLength: 1, maxLength: 500 }),
});
export const ListTransactionsQuery = Type.Object({
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
    type: Type.Optional(Type.Union([
        Type.Literal('PURCHASE'),
        Type.Literal('RESERVATION'),
        Type.Literal('COMMIT'),
        Type.Literal('REFUND'),
        Type.Literal('ADJUSTMENT'),
    ])),
});
export const ListClientsQuery = Type.Object({
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
});
