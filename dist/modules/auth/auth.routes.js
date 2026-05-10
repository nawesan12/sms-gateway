import IORedis from 'ioredis';
import { TextBeeProvider } from '../../modules/sms/providers/textbee.provider.js';
import { SmsService } from '../../modules/sms/sms.service.js';
import { DeviceRouter } from '../../modules/sms/device-router.js';
import { DeviceCrypto } from '../../modules/devices/crypto.js';
import { buildSmsQueue } from '../../queue/queues.js';
import { AuthService } from './auth.service.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthController } from './auth.controller.js';
import { CreateAccessLinkBody, ErrorResponse, SendCodeBody, SendCodeResponse, VerifyCodeBody, VerifyCodeResponse, } from './auth.schemas.js';
export async function registerAuthRoutes(app) {
    const env = app.env;
    const provider = new TextBeeProvider(env, app.log);
    const crypto = new DeviceCrypto(env.MASTER_ENCRYPTION_KEY_B64);
    const router = DeviceRouter.create(app.prisma, env, app.log);
    const smsService = new SmsService(app.prisma, env, app.log, provider, router, crypto);
    const { queue: smsQueue, client: smsQueueClient } = buildSmsQueue(env);
    const rlClient = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    app.addHook('onClose', async () => {
        await smsQueue.close();
        await smsQueueClient.quit().catch(() => undefined);
        await rlClient.quit().catch(() => undefined);
    });
    const service = new AuthService({
        prisma: app.prisma,
        env,
        logger: app.log,
        smsQueue,
        smsService,
        deviceRouter: router,
        signAccessToken: (payload) => app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_TTL_SEC }),
        signRefreshToken: (payload) => app.jwt.sign(payload, { expiresIn: env.JWT_REFRESH_TTL_SEC }),
    }, rlClient);
    const accessTokens = new AccessTokenService(app.prisma, env, app.log);
    const controller = new AuthController(service, accessTokens);
    app.post('/v1/auth/send-code', {
        schema: {
            body: SendCodeBody,
            response: { 200: SendCodeResponse, 400: ErrorResponse, 429: ErrorResponse },
            tags: ['auth'],
        },
        config: {
            rateLimit: {
                max: env.RATE_LIMIT_IP_MAX,
                timeWindow: env.RATE_LIMIT_IP_WINDOW_SEC * 1000,
            },
        },
    }, controller.sendCode);
    app.post('/v1/auth/verify-code', {
        schema: {
            body: VerifyCodeBody,
            response: { 200: VerifyCodeResponse, 400: ErrorResponse, 429: ErrorResponse },
            tags: ['auth'],
        },
    }, controller.verifyCode);
    app.post('/v1/admin/auth/access-link', {
        preHandler: app.requireOperator,
        schema: {
            body: CreateAccessLinkBody,
            tags: ['operator', 'auth'],
            security: [{ bootstrapToken: [] }],
        },
    }, controller.createAccessLink);
}
