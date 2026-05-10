import { Type } from '@sinclair/typebox';
export const CreateContactBody = Type.Object({
    phone: Type.String({ minLength: 1, maxLength: 32 }),
    name: Type.Optional(Type.String({ maxLength: 200 })),
    email: Type.Optional(Type.String({ maxLength: 200 })),
});
export const ListContactsQuery = Type.Object({
    search: Type.Optional(Type.String({ maxLength: 100 })),
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
});
export const ContactIdParam = Type.Object({
    id: Type.String({ format: 'uuid' }),
});
export const ImportCsvBody = Type.Object({
    csv: Type.String({ minLength: 1 }),
});
