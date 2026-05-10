export const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export function nowMs() {
    return Date.now();
}
export function addSeconds(date, seconds) {
    return new Date(date.getTime() + seconds * SECOND_MS);
}
export function isExpired(expiresAt, ref = new Date()) {
    return expiresAt.getTime() <= ref.getTime();
}
