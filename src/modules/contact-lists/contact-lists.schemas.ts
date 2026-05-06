import { Type, type Static } from '@sinclair/typebox';

export const CreateListBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.Optional(Type.String({ maxLength: 1000 })),
});
export type CreateListBodyT = Static<typeof CreateListBody>;

export const UpdateListBody = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  description: Type.Optional(Type.String({ maxLength: 1000 })),
});
export type UpdateListBodyT = Static<typeof UpdateListBody>;

export const ListIdParam = Type.Object({ id: Type.String({ format: 'uuid' }) });
export type ListIdParamT = Static<typeof ListIdParam>;

export const ListMemberParam = Type.Object({
  id: Type.String({ format: 'uuid' }),
  contactId: Type.String({ format: 'uuid' }),
});
export type ListMemberParamT = Static<typeof ListMemberParam>;

export const AddMembersBody = Type.Object({
  contactIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 1, maxItems: 1000 }),
});
export type AddMembersBodyT = Static<typeof AddMembersBody>;

export const ListMembersQuery = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
});
export type ListMembersQueryT = Static<typeof ListMembersQuery>;
