import { z } from 'zod';

const truthy = z
  .union([z.boolean(), z.string()])
  .transform((v) =>
    typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()),
  );

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default('0.0.0.0'),

    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    // ⚠️ CLAVES DIDÁCTICAS — defaults para que el deploy en Render free funcione
    // ingresando solo DATABASE_URL + REDIS_URL. En un deploy real, sobreescribir
    // las cuatro env vars de abajo con valores propios y nunca versionarlas.
    JWT_PRIVATE_KEY_B64: z
      .string()
      .min(1)
      .default(
        'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2QUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktZd2dnU2lBZ0VBQW9JQkFRQ3JpazQ1ZkRVdXhuV08KTndiRy9WNWpZSWx3Y3JGajBONVU4SjlrVjNPZExOR3JJbU1TZTYwL0hXZzFzTE9CMnFKaFBqcjBURlpuVlpJTgo3bWM1VHRNTUxoT2RsWk5WT1d5S2dWZi9YSWVVamFreHJqU0Y5RTZDV0V6dHFvSkIxaHJ3RlFVMU8ydHVuUXNTCisvc3pvNWJFNGFBdTF0RjZiMGNwcnk1dSs4aWhRTVhXdGtqeXRVVENxZmZYZnBIVTVXNEN1SHYrcGxGQTUzdTcKV3gyWURFS2ViN2dFemxhVEdXRG5FelNMVzVJTFZkaWxDbmpJNm84ZUlzVW5LeDBZeE5helNqRytvN1BzWEFJLwo4QWJ5U2lGU0Zvb3BqV0g2TDltWW8vZzNybE9yTnc5bkF1MmtiZ1d0NDN2cHczakMxdWRSVHB4dGxUblZKS3ltCjdPbjJTYmtkQWdNQkFBRUNnZ0VBUmhqSHUyVGVwS1VUYjVCYjFCL0FITkxiaHRoUFZhOEowMkxhZDFubkZDQzIKOHZ3anlPOUNEY3I2QlFxV1orZE1PSG1DQk1kVy9YWHhyNEN1ckxQaHVSWHhEUkdNdWFRMER1c281dUJNUk8rWQpab1U5MEVsVGRaOFluSHZ6SzIwTzUvRm5CZWdvai9SYmpKL3NlQjhPb3BoaWFSRitXMDR5b2IyRXQzUnErVDAvCnp5TFhFbjFEZEdCMHY5UnYvc3lxMFpqdDh3Y1hwVWlsTU5qTk9ZdlRXcXZPSElPMGgxMHB6RlMvNnFmMlh0WlEKRGJxVFRvL1VOOE8zSEFoL2hVQkkvcDdpS1RBUjZDVGJrVDRyR0NpVWlxcHAyd0lQQzFzV3pKcUliSU5Mei9CdgpDSkJoL0NEeDl0cGlRNGV6ZWVRVGJBQytCdXRmZDJBaWZzeWtPMGFRcndLQmdRRGFxSjJUQXVSRkpsWHNlVXE0CkMrMEU0YWVrQWNDdFdySmt1Rjc4WlRwTmw5RkhHWXVxeEtralRudFVkSGxpNCtOb05ibFBZM3diMW83d1E4MTkKdzJGSm00TzdIOEhFOE5ic3B5NmU3bkowZVIzMmVVV0VZcTAvZEhVcE1icUYwbUJmK3JlRGU4Tk03TU1IUUd6dwpNUnFpYkVXNFZudjZGOGR5TjNHQm53SjJZd0tCZ1FESTFjRDVjMEhEbU1FSER3OW9jSDBvZHFXYWVzcU5kd3B0CmJVWU0zTjk1aTRUVVRZa1ZiMUZlSGRMMmtGOWJWK2ZXTW1QcFpxQURGbFJDWnBMOXFVcXg1RkwwK1MraE4yYWgKcStCY1RBNUZScTZyZDhTQXJXS1dQbjhDazFjZHdUNkNCc1JtY0xJeU0zd2dsR0oxWU5sbDFJS1ZnZUF6WisyTApibUJ0TElScWZ3S0JnR2RGcGc2dUdmUVM5QmdZL1ZKSng2czdqTHJvWFFGRFNlaEtNQXFUSU9OTzVmZm50OUJ5Cnk5T3lHSXU5NnlycXFSZ3A3NWp3U3NpM0lKR1g1SEVXbTFkeGpOa1BXYXhUZDU4VUl1L0xmT0ZINXYvbkxROG0Kcjk2OWVTeDRvVGpkTU1tRUY3S1EvSi9UWHhXSXR5c0dkaWJxYms5dkFXVVFZQkd3My9veGlLOHpBb0dBUndKdApETVlYeHBUSUN6cmo4OFZ5TzFCWUZWcTlLMitmbkRrNnYybUpDbXl1Tm5LRHViUjJUSlMyOXI3dE9GckllZyt2CkMrTmhTRFlvN0tGZjc1aGY5SzRLTnR1MFg0ZzdIWWFyK1haYXhWdk1mb3dHU29rRGhxUHFQSHJrSG4wcElNaEwKd1B5dnhOZzNWejJmNG1pdjlUVkNScUo1SnpQajVaek5NMHkrTlBrQ2dZQlNWNzcxWS8xc3NZKzN1NlAxenNteQpZVGRrYm5YMXRzZGZZNVptanQyeWlxcDNjaHNXbndVeVh3RHl5OGZTR0NCeHcxYjdYMVFGVUxHLzVZT2VkTlIwCm5XeU14dFBxWVJGZFBUYjFnTnFaMmZBd0NoejkvSDVHZlBDeUUxcTA0dTE0RUEvY1VJZDRFYkdwKzZEZ2NBOHAKZHJZRFdpczZGUWVvcGZMOTVmUjNLdz09Ci0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0K',
      ),
    JWT_PUBLIC_KEY_B64: z
      .string()
      .min(1)
      .default(
        'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUFxNHBPT1h3MUxzWjFqamNHeHYxZQpZMkNKY0hLeFk5RGVWUENmWkZkem5TelJxeUpqRW51dFB4MW9OYkN6Z2RxaVlUNDY5RXhXWjFXU0RlNW5PVTdUCkRDNFRuWldUVlRsc2lvRlgvMXlIbEkycE1hNDBoZlJPZ2xoTTdhcUNRZFlhOEJVRk5UdHJicDBMRXZ2N002T1cKeE9HZ0x0YlJlbTlIS2E4dWJ2dklvVURGMXJaSThyVkV3cW4zMTM2UjFPVnVBcmg3L3FaUlFPZDd1MXNkbUF4QwpubSs0Qk01V2t4bGc1eE0waTF1U0MxWFlwUXA0eU9xUEhpTEZKeXNkR01UV3Mwb3h2cU96N0Z3Q1AvQUc4a29oClVoYUtLWTFoK2kvWm1LUDRONjVUcXpjUFp3THRwRzRGcmVONzZjTjR3dGJuVVU2Y2JaVTUxU1NzcHV6cDlrbTUKSFFJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tCg==',
      ),
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
      .default('O7+foC32IPTKHaPif4W2wC4rvqSEyloHfbutr58khmg=')
      .refine((v) => Buffer.from(v, 'base64').length === 32, {
        message: 'MASTER_ENCRYPTION_KEY_B64 must decode to exactly 32 bytes',
      }),

    ADMIN_BOOTSTRAP_TOKEN: z
      .string()
      .min(8)
      .default('9ef85a6cf8ef505bbe56d08d0a57d6aae14da1d1cfb20342'),

    // Service-account de Firebase como JSON multiline (lo descargás de
    // Project Settings → Service accounts → Generate new private key).
    // Una sola env, copiá el archivo entero. Si está vacío, los envíos
    // fallan con NO_FCM_CONFIG (útil para dev local sin Firebase).
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

    // TTL en segundos: si un device no manda heartbeat en este lapso,
    // el worker lo marca OFFLINE y el router lo skipea.
    DEVICE_OFFLINE_AFTER_SEC: z.coerce.number().int().positive().default(300),

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
    APP_BASE_URL: data.APP_BASE_URL ?? data.RENDER_EXTERNAL_URL ?? 'http://localhost:3000',
  }));

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

// Pre-flight checks: detectan misconfigs comunes (URL directa de Supabase
// en lugar del pooler, Redis sin TLS, etc.) y los avisan en logs claros.
// No abortan el boot — solo emiten warnings para acelerar el debugging.
function preflightWarnings(env: AppEnv): string[] {
  const warnings: string[] = [];

  // DATABASE_URL: pooler de Supabase usa puerto 6543 + pgbouncer=true.
  // Si vemos puerto 5432 con un host de Supabase, casi seguro pegaron la directa.
  if (env.NODE_ENV === 'production') {
    const isSupabase = /\.supabase\.(co|com)/.test(env.DATABASE_URL);
    if (isSupabase && /:5432\b/.test(env.DATABASE_URL)) {
      warnings.push(
        'DATABASE_URL parece ser la URL "Direct connection" de Supabase ' +
          '(puerto 5432). En Render usar la "Connection pooling" (puerto 6543) ' +
          '— la directa es IPv6-only y los queries van a fallar con ENETUNREACH.',
      );
    }
    if (isSupabase && !/pgbouncer=true/.test(env.DATABASE_URL)) {
      warnings.push(
        'DATABASE_URL apunta a Supabase sin ?pgbouncer=true. `prisma db push` ' +
          'y prepared statements pueden fallar contra el pooler en transaction mode.',
      );
    }

    // REDIS_URL: Upstash exige TLS (rediss://). redis:// va a fallar handshake.
    if (env.REDIS_URL.startsWith('redis://') && /upstash\.io/.test(env.REDIS_URL)) {
      warnings.push(
        'REDIS_URL apunta a Upstash con redis:// (sin TLS). Upstash requiere ' +
          'TLS — usar la "TLS connection string" que empieza con rediss://.',
      );
    }
  }

  return warnings;
}

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

  const warnings = preflightWarnings(cached);
  for (const w of warnings) {
    console.warn(`[env] ⚠️  ${w}`);
  }

  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}
