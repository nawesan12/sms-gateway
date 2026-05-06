import pino, { type Logger, type LoggerOptions } from 'pino';
import type { AppEnv } from '@/config/env.js';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  'req.body.code',
  'req.body.phone',
  'req.body.apiKey',
  '*.apiKey',
  '*.code',
  '*.codeHash',
  '*.password',
];

export function buildLoggerOptions(env: AppEnv): LoggerOptions {
  const opts: LoggerOptions = {
    level: env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    base: { service: 'sms-gateway', env: env.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  if (env.NODE_ENV === 'development') {
    return {
      ...opts,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
      },
    };
  }
  return opts;
}

export function buildLogger(env: AppEnv): Logger {
  return pino(buildLoggerOptions(env));
}
