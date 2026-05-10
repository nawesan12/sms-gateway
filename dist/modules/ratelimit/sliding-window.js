/**
 * Lua-based sliding window using ZSET. Ensures atomic count + add + trim.
 * Score = timestamp ms, member = unique entry id (timestamp:rand).
 */
const LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]
local minScore = now - windowMs
redis.call('ZREMRANGEBYSCORE', key, '-inf', minScore)
local count = redis.call('ZCARD', key)
if count >= max then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local resetMs = windowMs
  if oldest and oldest[2] then
    resetMs = (tonumber(oldest[2]) + windowMs) - now
  end
  return {0, count, resetMs}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, windowMs)
return {1, count + 1, windowMs}
`;
export class SlidingWindow {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async hit(key, windowSec, max) {
        const now = Date.now();
        const windowMs = windowSec * 1000;
        const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;
        const result = (await this.redis.eval(LUA, 1, key, now, windowMs, max, member));
        return {
            allowed: result[0] === 1,
            count: result[1],
            resetInSec: Math.max(1, Math.ceil(result[2] / 1000)),
        };
    }
}
