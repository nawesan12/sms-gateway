import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const TONE = {
    gray: { bg: 'bg-canvas-overlay', fg: 'text-ink-secondary', border: 'border-line', dot: 'bg-ink-muted' },
    ok: { bg: 'bg-signal-ok/10', fg: 'text-signal-ok', border: 'border-signal-ok/30', dot: 'bg-signal-ok' },
    err: { bg: 'bg-signal-err/10', fg: 'text-signal-err', border: 'border-signal-err/30', dot: 'bg-signal-err' },
    warn: { bg: 'bg-signal-warn/10', fg: 'text-signal-warn', border: 'border-signal-warn/30', dot: 'bg-signal-warn' },
    info: { bg: 'bg-signal-info/10', fg: 'text-signal-info', border: 'border-signal-info/30', dot: 'bg-signal-info' },
    accent: { bg: 'bg-accent/10', fg: 'text-accent', border: 'border-accent/30', dot: 'bg-accent' },
};
const STATUS_TONE = {
    ACTIVE: 'ok',
    INACTIVE: 'gray',
    OFFLINE: 'err',
    DRAFT: 'gray',
    QUEUED: 'info',
    RUNNING: 'warn',
    PAUSED: 'gray',
    COMPLETED: 'ok',
    FAILED: 'err',
    CANCELED: 'gray',
    PENDING: 'warn',
    SENT: 'ok',
    DELIVERED: 'ok',
    RETRYING: 'warn',
    SKIPPED: 'gray',
    CLOSED: 'ok',
    OPEN: 'err',
    HALF_OPEN: 'warn',
};
export function Badge({ tone, children, pulse }) {
    const text = typeof children === 'string' ? children : '';
    const t = tone ?? STATUS_TONE[text] ?? 'gray';
    const { bg, fg, border, dot } = TONE[t];
    const isLive = pulse ??
        (text === 'RUNNING' || text === 'PENDING' || text === 'RETRYING' || text === 'QUEUED');
    return (_jsxs("span", { className: `pill ${bg} ${fg} ${border}`, children: [_jsx("span", { className: `relative inline-block w-1.5 h-1.5 rounded-full ${dot}`, children: isLive && (_jsx("span", { className: `absolute inset-0 rounded-full ${dot} animate-pulse-dot` })) }), children] }));
}
