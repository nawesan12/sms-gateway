export interface SlidingWindowResult {
  allowed: boolean;
  count: number;
  resetInSec: number;
}

// Sliding window en memoria. Reemplaza el ZSET + Lua de Redis por un Map de
// timestamps por clave. Trade-off aceptado: si el proceso se reinicia, los
// contadores arrancan en cero. Vale para este deploy (1 sólo proceso, OTP
// tiene TTL propio en DB y el riesgo es bajo).
export class SlidingWindow {
  private readonly buckets = new Map<string, number[]>();
  private lastSweep = Date.now();

  // Limpieza global cada `sweepIntervalMs` para que `buckets` no crezca por
  // claves abandonadas.
  private readonly sweepIntervalMs = 60_000;

  hit(key: string, windowSec: number, max: number): SlidingWindowResult {
    const now = Date.now();
    const windowMs = windowSec * 1000;
    const minTs = now - windowMs;

    this.maybeSweep(now);

    const arr = this.buckets.get(key) ?? [];
    // Trim viejos
    let i = 0;
    while (i < arr.length && arr[i]! <= minTs) i++;
    const fresh = i === 0 ? arr : arr.slice(i);

    if (fresh.length >= max) {
      const oldest = fresh[0]!;
      const resetMs = oldest + windowMs - now;
      this.buckets.set(key, fresh);
      return {
        allowed: false,
        count: fresh.length,
        resetInSec: Math.max(1, Math.ceil(resetMs / 1000)),
      };
    }

    fresh.push(now);
    this.buckets.set(key, fresh);
    return { allowed: true, count: fresh.length, resetInSec: Math.ceil(windowMs / 1000) };
  }

  private maybeSweep(now: number): void {
    if (now - this.lastSweep < this.sweepIntervalMs) return;
    this.lastSweep = now;
    // Borra cualquier bucket cuyo último timestamp tenga más de 1 día.
    const cutoff = now - 24 * 60 * 60 * 1000;
    for (const [key, arr] of this.buckets) {
      const last = arr[arr.length - 1];
      if (last === undefined || last < cutoff) {
        this.buckets.delete(key);
      }
    }
  }
}
