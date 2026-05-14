export const ERROR_CODES = {
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_USED: 'OTP_USED',
  OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
  RATE_LIMITED_IP: 'RATE_LIMITED_IP',
  RATE_LIMITED_PHONE: 'RATE_LIMITED_PHONE',
  COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
  DEVICE_OFFLINE: 'DEVICE_OFFLINE',
  SMS_PROVIDER_DOWN: 'SMS_PROVIDER_DOWN',
  INVALID_PHONE: 'INVALID_PHONE',
  BLACKLISTED: 'BLACKLISTED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INSUFFICIENT_TOKENS: 'INSUFFICIENT_TOKENS',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const AUDIT_EVENTS = {
  OTP_REQUESTED: 'otp.requested',
  OTP_VERIFIED_SUCCESS: 'otp.verified.success',
  OTP_VERIFIED_FAIL: 'otp.verified.fail',
  OTP_RATE_LIMITED: 'otp.rate_limited',
  OTP_BLACKLISTED: 'otp.blacklisted',
  SMS_SENT: 'sms.sent',
  SMS_FAILED: 'sms.failed',
  DEVICE_CREATED: 'device.created',
  DEVICE_UPDATED: 'device.updated',
  DEVICE_DELETED: 'device.deleted',
  DEVICE_CIRCUIT_OPEN: 'device.circuit.open',
  DEVICE_CIRCUIT_CLOSE: 'device.circuit.close',
  ADMIN_LOGIN: 'admin.login',
  TOKEN_TOPUP: 'token.topup',
  TOKEN_RESERVED: 'token.reserved',
  TOKEN_COMMITTED: 'token.committed',
  TOKEN_REFUNDED: 'token.refunded',
  TOKEN_INSUFFICIENT: 'token.insufficient',
  CAMPAIGN_PAUSED_INSUFFICIENT_TOKENS: 'campaign.paused.insufficient_tokens',
  CAMPAIGN_PAUSED_FCM_FATAL: 'campaign.paused.fcm_fatal',
  ACCESS_TOKEN_ISSUED: 'access_token.issued',
  ACCESS_TOKEN_USED: 'access_token.used',
} as const;

export const QUEUE_NAMES = {
  SMS_SEND: 'sms.send',
  SMS_DLQ: 'sms.dlq',
  DEVICE_HEALTH: 'device.health',
  CAMPAIGN_SEND: 'campaign.send',
} as const;
