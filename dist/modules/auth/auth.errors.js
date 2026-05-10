import { AppError } from '../../plugins/error-handler.js';
import { ERROR_CODES } from '../../config/constants.js';
export const invalidPhone = (msg = 'Invalid phone number') => new AppError(ERROR_CODES.INVALID_PHONE, msg, 400);
export const rateLimitedIp = (resetSec) => new AppError(ERROR_CODES.RATE_LIMITED_IP, 'Too many requests from this IP', 429, { resetSec });
export const rateLimitedPhone = (resetSec) => new AppError(ERROR_CODES.RATE_LIMITED_PHONE, 'Daily OTP limit reached for this phone', 429, {
    resetSec,
});
export const cooldownActive = (resetSec) => new AppError(ERROR_CODES.COOLDOWN_ACTIVE, 'Wait before requesting another code', 429, {
    resetSec,
});
export const blacklisted = (reason) => new AppError(ERROR_CODES.BLACKLISTED, 'Request blocked', 403, { reason });
export const otpInvalid = () => new AppError(ERROR_CODES.OTP_INVALID, 'Invalid code', 400);
export const otpExpired = () => new AppError(ERROR_CODES.OTP_EXPIRED, 'Code expired', 400);
export const otpUsed = () => new AppError(ERROR_CODES.OTP_USED, 'Code already used', 400);
export const otpMaxAttempts = () => new AppError(ERROR_CODES.OTP_MAX_ATTEMPTS, 'Too many attempts', 429);
