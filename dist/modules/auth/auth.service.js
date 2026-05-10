import { OtpService } from '@/modules/otp/otp.service.js';
import { RateLimitService } from '@/modules/ratelimit/rate-limit.service.js';
import { AbuseService } from '@/modules/abuse/abuse.service.js';
import { AuditService } from '@/modules/audit/audit.service.js';
import { UserService } from '@/modules/users/user.service.js';
import { validateAndNormalizePhone } from '@/lib/phone.js';
import { maskPhone } from '@/lib/mask.js';
import { metrics } from '@/plugins/metrics.js';
import { AUDIT_EVENTS } from '@/config/constants.js';
import { blacklisted, cooldownActive, invalidPhone, otpExpired, otpInvalid, otpMaxAttempts, otpUsed, rateLimitedIp, rateLimitedPhone, } from './auth.errors.js';
export class AuthService {
    deps;
    otp;
    rate;
    abuse;
    audit;
    users;
    constructor(deps, redisRateLimitClient) {
        this.deps = deps;
        this.otp = new OtpService(deps.prisma, deps.env, deps.logger);
        this.rate = new RateLimitService(redisRateLimitClient, deps.env);
        this.abuse = new AbuseService(deps.prisma, deps.logger);
        this.audit = new AuditService(deps.prisma, deps.logger);
        this.users = new UserService(deps.prisma);
    }
    async sendCode(input) {
        const validation = validateAndNormalizePhone(input.rawPhone, this.deps.env.DEFAULT_PHONE_REGION);
        if (!validation.valid) {
            metrics.otpSent.labels({ result: 'invalid_phone' }).inc();
            throw invalidPhone();
        }
        const phoneE164 = validation.e164;
        const abuse = await this.abuse.check({ phoneE164, ipAddress: input.ipAddress });
        if (abuse.blocked) {
            metrics.otpSent.labels({ result: 'blacklisted' }).inc();
            await this.audit.record({
                eventType: AUDIT_EVENTS.OTP_BLACKLISTED,
                actorType: 'system',
                targetType: 'phone',
                targetId: phoneE164,
                ipAddress: input.ipAddress ?? null,
                correlationId: input.correlationId,
                metadata: { reason: abuse.reason },
            });
            throw blacklisted(abuse.reason);
        }
        if (input.ipAddress) {
            const ipCheck = await this.rate.checkIp(input.ipAddress);
            if (!ipCheck.allowed) {
                metrics.rateLimitBlocks.labels({ scope: 'ip' }).inc();
                metrics.otpSent.labels({ result: 'rl_ip' }).inc();
                throw rateLimitedIp(ipCheck.resetInSec);
            }
        }
        const cooldown = await this.rate.checkPhoneCooldown(phoneE164);
        if (!cooldown.allowed) {
            metrics.rateLimitBlocks.labels({ scope: 'phone_cooldown' }).inc();
            metrics.otpSent.labels({ result: 'cooldown' }).inc();
            throw cooldownActive(cooldown.resetInSec);
        }
        const daily = await this.rate.checkPhoneDaily(phoneE164);
        if (!daily.allowed) {
            metrics.rateLimitBlocks.labels({ scope: 'phone_daily' }).inc();
            metrics.otpSent.labels({ result: 'rl_phone' }).inc();
            throw rateLimitedPhone(daily.resetInSec);
        }
        // Pre-select a device to satisfy SmsMessage.deviceId FK; worker may
        // re-route to a different device if this one fails (excludeDeviceIds).
        const initialDevice = await this.deps.deviceRouter.select();
        const otp = await this.otp.createOtp({
            phoneE164,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        });
        const message = this.otp.buildMessage(otp.plainCode);
        const smsId = await this.deps.smsService.createPending({
            deviceId: initialDevice.id,
            recipientE164: phoneE164,
            otpRequestId: otp.requestId,
        });
        await this.deps.smsQueue.add('sms.send', {
            smsMessageId: smsId,
            otpRequestId: otp.requestId,
            recipientE164: phoneE164,
            message,
            correlationId: input.correlationId,
        }, {
            attempts: this.deps.env.WORKER_MAX_RETRIES + 1,
            backoff: { type: 'exponential', delay: this.deps.env.WORKER_BACKOFF_MS },
            removeOnComplete: { age: 3600, count: 1000 },
            removeOnFail: { age: 24 * 3600 },
        });
        metrics.otpSent.labels({ result: 'queued' }).inc();
        await this.audit.record({
            eventType: AUDIT_EVENTS.OTP_REQUESTED,
            actorType: 'user',
            targetType: 'phone',
            targetId: phoneE164,
            ipAddress: input.ipAddress ?? null,
            correlationId: input.correlationId,
            metadata: { requestId: otp.requestId, smsId },
        });
        return {
            requestId: otp.requestId,
            expiresInSec: otp.expiresInSec,
            cooldownSec: otp.cooldownSec,
            phoneMasked: maskPhone(phoneE164),
        };
    }
    async verifyCode(input) {
        const validation = validateAndNormalizePhone(input.rawPhone, this.deps.env.DEFAULT_PHONE_REGION);
        if (!validation.valid)
            throw invalidPhone();
        const phoneE164 = validation.e164;
        const trimmed = (input.code ?? '').trim();
        if (!/^\d{4,10}$/.test(trimmed)) {
            metrics.otpVerified.labels({ result: 'invalid' }).inc();
            throw otpInvalid();
        }
        const result = await this.otp.verifyOtp(phoneE164, trimmed);
        if (!result.ok) {
            metrics.otpVerified.labels({ result: result.reason.toLowerCase() }).inc();
            await this.audit.record({
                eventType: AUDIT_EVENTS.OTP_VERIFIED_FAIL,
                actorType: 'user',
                targetType: 'phone',
                targetId: phoneE164,
                ipAddress: input.ipAddress ?? null,
                correlationId: input.correlationId,
                metadata: { reason: result.reason },
            });
            switch (result.reason) {
                case 'EXPIRED':
                    throw otpExpired();
                case 'USED':
                    throw otpUsed();
                case 'MAX_ATTEMPTS':
                    throw otpMaxAttempts();
                default:
                    throw otpInvalid();
            }
        }
        const user = await this.users.getOrCreateByPhone(phoneE164);
        const tokenPayload = { sub: user.id, phone: user.phoneE164, role: user.role };
        const [accessToken, refreshToken] = await Promise.all([
            this.deps.signAccessToken(tokenPayload),
            this.deps.signRefreshToken(tokenPayload),
        ]);
        metrics.otpVerified.labels({ result: 'success' }).inc();
        await this.audit.record({
            eventType: AUDIT_EVENTS.OTP_VERIFIED_SUCCESS,
            actorType: 'user',
            actorId: user.id,
            targetType: 'phone',
            targetId: phoneE164,
            ipAddress: input.ipAddress ?? null,
            correlationId: input.correlationId,
        });
        return {
            user: { id: user.id, phoneE164: user.phoneE164, role: user.role },
            accessToken,
            refreshToken,
        };
    }
}
