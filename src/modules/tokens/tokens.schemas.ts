import { Type, type Static } from '@sinclair/typebox';

export const UserIdParam = Type.Object({
  userId: Type.String({ format: 'uuid' }),
});
export type UserIdParamT = Static<typeof UserIdParam>;

export const TopUpBody = Type.Object({
  amount: Type.Integer({ minimum: 1, maximum: 1_000_000 }),
  reason: Type.String({ minLength: 1, maxLength: 500 }),
});
export type TopUpBodyT = Static<typeof TopUpBody>;

export const ListTransactionsQuery = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
  type: Type.Optional(
    Type.Union([
      Type.Literal('PURCHASE'),
      Type.Literal('RESERVATION'),
      Type.Literal('COMMIT'),
      Type.Literal('REFUND'),
      Type.Literal('ADJUSTMENT'),
    ]),
  ),
});
export type ListTransactionsQueryT = Static<typeof ListTransactionsQuery>;

export const ListClientsQuery = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
});
export type ListClientsQueryT = Static<typeof ListClientsQuery>;
