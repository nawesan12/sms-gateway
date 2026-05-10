import { Type } from '@sinclair/typebox';
export const CreateCampaignBody = Type.Object({
    name: Type.String({ minLength: 1, maxLength: 200 }),
    messageTemplate: Type.String({ minLength: 1, maxLength: 1600 }),
    listId: Type.String({ format: 'uuid' }),
    tpsLimit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
});
export const ListCampaignsQuery = Type.Object({
    status: Type.Optional(Type.Union([
        Type.Literal('DRAFT'),
        Type.Literal('QUEUED'),
        Type.Literal('RUNNING'),
        Type.Literal('PAUSED'),
        Type.Literal('COMPLETED'),
        Type.Literal('FAILED'),
        Type.Literal('CANCELED'),
    ])),
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
});
export const CampaignIdParam = Type.Object({ id: Type.String({ format: 'uuid' }) });
export const CampaignDeliveriesQuery = Type.Object({
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, default: 100 })),
});
