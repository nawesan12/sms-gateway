import { SlidingWindow } from './sliding-window.js';
export class RateLimitService {
    env;
    window;
    constructor(redis, env) {
        this.env = env;
        this.window = new SlidingWindow(redis);
    }
    async checkPhoneDaily(phoneE164) {
        return this.window.hit(`rl:phone:daily:${phoneE164}`, 24 * 60 * 60, this.env.RATE_LIMIT_PHONE_DAILY_MAX);
    }
    async checkPhoneCooldown(phoneE164) {
        return this.window.hit(`rl:phone:cooldown:${phoneE164}`, this.env.RATE_LIMIT_PHONE_COOLDOWN_SEC, 1);
    }
    async checkIp(ip) {
        return this.window.hit(`rl:ip:${ip}`, this.env.RATE_LIMIT_IP_WINDOW_SEC, this.env.RATE_LIMIT_IP_MAX);
    }
}
