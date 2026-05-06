/**
 * Minimal logger interface compatible with both pino.Logger and Fastify's
 * FastifyBaseLogger. Services depend only on this surface to avoid coupling.
 */
export interface AppLogger {
  fatal(...args: unknown[]): void;
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  trace(...args: unknown[]): void;
  child(bindings: Record<string, unknown>): AppLogger;
}
