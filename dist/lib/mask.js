export function maskPhone(phone) {
    if (!phone || phone.length < 6)
        return '***';
    const head = phone.slice(0, 5);
    const tail = phone.slice(-2);
    const stars = '*'.repeat(Math.max(phone.length - head.length - tail.length, 1));
    return `${head}${stars}${tail}`;
}
export function maskApiKey(key) {
    if (!key)
        return '';
    if (key.length <= 8)
        return '*'.repeat(key.length);
    return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
