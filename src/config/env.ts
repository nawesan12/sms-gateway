import { z } from 'zod';

const truthy = z
  .union([z.boolean(), z.string()])
  .transform((v) =>
    typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_PRIVATE_KEY_B64: z.string().min(1),
  JWT_PUBLIC_KEY_B64: z.string().min(1),
  JWT_ACCESS_TTL_SEC: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SEC: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 7),
  JWT_ISSUER: z.string().default('sms-gateway'),
  JWT_AUDIENCE: z.string().default('sms-gateway-clients'),

  MASTER_ENCRYPTION_KEY_B64: z
    .string()
    .min(1)
    .refine((v) => Buffer.from(v, 'base64').length === 32, {
      message: 'MASTER_ENCRYPTION_KEY_B64 must decode to exactly 32 bytes',
    }),

  ADMIN_BOOTSTRAP_TOKEN: z.string().min(8),

  TEXTBEE_BASE_URL: z.string().url().default('https://api.textbee.dev/api/v1/gateway'),
  TEXTBEE_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  TEXTBEE_MAX_RETRIES: z.coerce.number().int().min(0).default(3),

  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_TTL_SEC: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_MESSAGE_TEMPLATE: z
    .string()
    .default('Tu codigo es {{code}}. Expira en {{minutes}} min. No lo compartas.'),

  RATE_LIMIT_IP_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_IP_WINDOW_SEC: z.coerce.number().int().positive().default(3600),
  RATE_LIMIT_PHONE_DAILY_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_PHONE_COOLDOWN_SEC: z.coerce.number().int().positive().default(60),

  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),

  DEFAULT_PHONE_REGION: z.string().length(2).default('AR'),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  WORKER_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  WORKER_BACKOFF_MS: z.coerce.number().int().positive().default(2000),

  CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  CIRCUIT_RESET_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  METRICS_ENABLED: truthy.default('true'),
  METRICS_IP_ALLOWLIST: z
    .string()
    .default('127.0.0.1,::1')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),

  // Render expone RENDER_EXTERNAL_URL automáticamente en runtime con la URL
  // pública del service. Si APP_BASE_URL no está seteada, la usamos como
  // fallback — un env var menos para pegar a mano en el dashboard.
  RENDER_EXTERNAL_URL: z.string().url().optional(),
  APP_BASE_URL: z.string().url().optional(),

  BOOTSTRAP_ADMIN_PHONE: z.string().default('+5491100000001'),

  // Swagger UI (/docs): por default abierto en dev, cerrado en producción.
  // Forzar override con SWAGGER_UI_ENABLED=true (útil para demos públicas).
  SWAGGER_UI_ENABLED: truthy.optional(),
})
  .transform((data) => ({
    ...data,
    APP_BASE_URL:
      data.APP_BASE_URL ?? data.RENDER_EXTERNAL_URL ?? 'http://localhost:3000',
  }));

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}
