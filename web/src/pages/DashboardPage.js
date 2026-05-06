import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/api/stats';
import { devicesApi } from '@/api/devices';
import { campaignsApi } from '@/api/campaigns';
import { Badge } from '@/components/Badge';
import { ProgressBar } from '@/components/ProgressBar';
export function DashboardPage() {
    const stats = useQuery({ queryKey: ['stats'], queryFn: statsApi.get, refetchInterval: 5_000 });
    const devices = useQuery({ queryKey: ['devices'], queryFn: devicesApi.list });
    const running = useQuery({
        queryKey: ['campaigns', 'running'],
        queryFn: () => campaignsApi.list({ pageSize: 6 }),
        refetchInterval: 3_000,
    });
    const activeDevices = devices.data?.items.filter((d) => d.status === 'ACTIVE').length ?? 0;
    const totalDevices = devices.data?.items.length ?? 0;
    const sent = stats.data?.sms.sent ?? 0;
    const failed = stats.data?.sms.failed ?? 0;
    const total = stats.data?.sms.total ?? 0;
    const failureRate = total === 0 ? 0 : (failed / total) * 100;
    return (_jsxs("div", { className: "space-y-10", children: [_jsxs("header", { className: "flex items-end justify-between border-b border-line pb-6", children: [_jsxs("div", { children: [_jsx("p", { className: "section-eyebrow mb-2", children: "\u2014 overview \u00B7 last 24h" }), _jsxs("h1", { className: "font-display text-6xl leading-none", children: ["Dashboard", _jsx("span", { className: "text-accent", children: "." })] })] }), _jsxs("div", { className: "text-right text-2xs uppercase tracking-widest font-mono text-ink-muted", children: [_jsx("p", { children: new Date().toLocaleDateString('es-AR', {
                                    weekday: 'long',
                                    day: '2-digit',
                                    month: 'short',
                                }) }), _jsx("p", { className: "mt-0.5 text-ink-dim", children: "refresh \u00B7 5s" })] })] }), _jsxs("section", { className: "grid grid-cols-12 gap-px bg-line border border-line", children: [_jsx(KpiCard, { className: "col-span-12 lg:col-span-5 p-8", eyebrow: "01 \u00B7 sms enviados", value: sent, accent: true }), _jsx(KpiCard, { className: "col-span-6 lg:col-span-3 p-6", eyebrow: "02 \u00B7 fallidos", value: failed, tone: failed > 0 ? 'err' : undefined }), _jsx(KpiCard, { className: "col-span-6 lg:col-span-2 p-6", eyebrow: "03 \u00B7 devices", value: `${activeDevices}/${totalDevices}`, small: true }), _jsx(KpiCard, { className: "col-span-12 lg:col-span-2 p-6", eyebrow: "04 \u00B7 tasa fallo", value: `${failureRate.toFixed(1)}%`, small: true, tone: failureRate > 5 ? 'warn' : undefined })] }), _jsxs("section", { children: [_jsxs("div", { className: "flex items-end justify-between mb-4", children: [_jsxs("div", { children: [_jsx("p", { className: "section-eyebrow mb-1", children: "\u2014 traffic \u00B7 live" }), _jsx("h2", { className: "font-display text-3xl", children: "Campa\u00F1as recientes" })] }), _jsx(Link, { to: "/campaigns", className: "text-2xs uppercase tracking-widest font-mono text-ink-secondary hover:text-accent", children: "ver todas \u2192" })] }), running.data && running.data.items.length > 0 ? (_jsx("div", { className: "space-y-2", children: running.data.items.map((c) => (_jsxs(Link, { to: `/campaigns/${c.id}`, className: "surface block px-5 py-4 hover:bg-canvas-overlay transition-colors group", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "font-display text-xl text-ink-primary group-hover:text-accent transition-colors", children: c.name }), _jsx(Badge, { children: c.status })] }), _jsxs("p", { className: "mt-1 text-xs text-ink-muted truncate font-mono", children: ["> ", c.messageTemplate] })] }), _jsxs("div", { className: "text-right shrink-0 font-mono text-2xs uppercase tracking-widest", children: [_jsx("span", { className: "text-ink-primary tabular", children: c.sentCount }), _jsx("span", { className: "text-ink-dim mx-1", children: "/" }), _jsx("span", { className: "text-ink-secondary tabular", children: c.totalRecipients })] })] }), c.totalRecipients > 0 && (_jsx("div", { className: "mt-3", children: _jsx(ProgressBar, { value: c.sentCount + c.failedCount, max: c.totalRecipients, segments: 48 }) }))] }, c.id))) })) : (_jsx("p", { className: "text-sm text-ink-muted font-mono", children: "\u2014 sin actividad reciente \u2014" }))] }), _jsxs("section", { children: [_jsx("div", { className: "divider-label mb-4", children: "device fleet" }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3", children: [devices.data?.items.map((d) => (_jsxs("div", { className: "surface px-4 py-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "font-medium text-ink-primary", children: d.name }), _jsx(Badge, { children: d.status })] }), _jsxs("p", { className: "mt-1 text-2xs font-mono text-ink-muted", children: ["circuit \u00B7 ", _jsx("span", { className: "text-ink-secondary", children: d.circuitState }), " \u00B7 prio", ' ', _jsx("span", { className: "text-ink-secondary", children: d.priority })] })] }, d.id))), devices.data?.items.length === 0 && (_jsx("p", { className: "text-sm text-ink-muted font-mono col-span-full", children: "\u2014 sin devices \u2014" }))] })] })] }));
}
function KpiCard({ className, eyebrow, value, small, accent, tone, }) {
    const valueColor = accent
        ? 'text-accent'
        : tone === 'err'
            ? 'text-signal-err'
            : tone === 'warn'
                ? 'text-signal-warn'
                : 'text-ink-primary';
    return (_jsxs("div", { className: `bg-canvas-elevated relative overflow-hidden ${className}`, children: [_jsx("p", { className: "section-eyebrow", children: eyebrow }), _jsx("p", { className: `font-display ${small ? 'text-5xl' : 'text-7xl'} leading-none mt-4 tabular ${valueColor}`, children: value })] }));
}
