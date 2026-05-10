import { AdminController } from './admin.controller.js';
import { ListOtpQuery, ListSmsQuery, } from './admin.schemas.js';
export async function registerAdminRoutes(app) {
    const controller = new AdminController(app.prisma);
    app.get('/v1/admin/sms', {
        preHandler: app.requireAdmin,
        schema: { querystring: ListSmsQuery, tags: ['admin'], security: [{ bearerAuth: [] }] },
    }, controller.listSms);
    app.get('/v1/admin/otp', {
        preHandler: app.requireAdmin,
        schema: { querystring: ListOtpQuery, tags: ['admin'], security: [{ bearerAuth: [] }] },
    }, controller.listOtp);
    app.get('/v1/admin/stats', {
        preHandler: app.requireAdmin,
        schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    }, controller.stats);
}
