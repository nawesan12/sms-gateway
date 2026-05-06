import type Redis from 'ioredis';
import type { AppEnv } from '@/config/env.js';
import { SlidingWindow } from './sliding-window.js';

export type RateCheck = {
  allowed: boolean;
  count: number;
  resetInSec: number;
};

export class RateLimitService {
  private readonly window: SlidingWindow;

  constructor(
    redis: Redis,
    private readonly env: AppEnv,
  ) {
    this.window = new SlidingWindow(redis);
  }

  async checkPhoneDaily(phoneE164: string): Promise<RateCheck> {
    return this.window.hit(
      `rl:phone:daily:${phoneE164}`,
      24 * 60 * 60,
      this.env.RATE_LIMIT_PHONE_DAILY_MAX,
    );
  }

  async checkPhoneCooldown(phoneE164: string): Promise<RateCheck> {
    return this.window.hit(
      `rl:phone:cooldown:${phoneE164}`,
      this.env.RATE_LIMIT_PHONE_COOLDOWN_SEC,
      1,
    );
  }

  async checkIp(ip: string): Promise<RateCheck> {
    return this.window.hit(
      `rl:ip:${ip}`,
      this.env.RATE_LIMIT_IP_WINDOW_SEC,
      this.env.RATE_LIMIT_IP_MAX,
    );
  }
}
