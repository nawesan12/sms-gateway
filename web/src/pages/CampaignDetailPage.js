import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignsApi } from '@/api/campaigns';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { ProgressBar } from '@/components/ProgressBar';
export function CampaignDetailPage() {
    const qc = useQueryClient();
    const { id = '' } = useParams();
    const detail = useQuery({
        queryKey: ['campaign', id],
        queryFn: () => campaignsApi.getById(id),
        refetchInterval: 2_000,
        enabled: !!id,
    });
    const deliveries = useQuery({
        queryKey: ['campaign', id, 'deliveries'],
        queryFn: () => campaignsApi.deliveries(id, { pageSize: 200 }),
        refetchInterval: 3_000,
        enabled: !!id,
    });
    const launch = useMutation({
        mutationFn: () => campaignsApi.launch(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', id] }),
    });
    const cancel = useMutation({
        mutationFn: () => campaignsApi.cancel(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', id] }),
    });
    const c = detail.data;
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx(Link, { to: "/campaigns", className: "text-2xs uppercase tracking-widest font-mono text-ink-muted hover:text-accent", children: "\u2190 campa\u00F1as" }), c && (_jsxs("header", { className: "mt-2 flex items-end justify-between border-b border-line pb-6 gap-6", children: [_jsxs("div", { children: [_jsxs("p", { className: "section-eyebrow mb-2", children: ["\u2014 broadcast \u00B7 tps ", c.tpsLimit, "/s"] }), _jsxs("div", { className: "flex items-center gap-3 mb-1", children: [_jsx("h1", { className: "font-display text-5xl leading-none", children: c.name }), _jsx(Badge, { children: c.status })] })] }), _jsxs("div", { className: "flex gap-2 shrink-0", children: [c.status === 'DRAFT' && (_jsx(Button, { onClick: () => launch.mutate(), loading: launch.isPending, children: "\u25B6 Lanzar" })), (c.status === 'QUEUED' || c.status === 'RUNNING') && (_jsx(Button, { variant: "danger", onClick: () => cancel.mutate(), loading: cancel.isPending, children: "\u25A0 Cancelar" }))] })] }))] }), c && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "surface p-6 relative", children: [_jsx("p", { className: "section-eyebrow mb-3", children: "/ message template" }), _jsx("pre", { className: "font-mono text-sm text-ink-primary whitespace-pre-wrap leading-relaxed", children: c.messageTemplate })] }), _jsxs("div", { className: "grid grid-cols-12 gap-px bg-line border border-line", children: [_jsx(Stat, { className: "col-span-12 lg:col-span-6 p-8", eyebrow: "01 \u00B7 progreso", value: `${(((c.sentCount + c.failedCount) / Math.max(1, c.totalRecipients)) * 100).toFixed(1)}%`, accent: true, big: true }), _jsx(Stat, { className: "col-span-6 lg:col-span-2 p-6", eyebrow: "02 \u00B7 sent", value: c.sentCount, tone: "ok" }), _jsx(Stat, { className: "col-span-6 lg:col-span-2 p-6", eyebrow: "03 \u00B7 pending", value: c.deliveriesByStatus.PENDING ?? 0 }), _jsx(Stat, { className: "col-span-12 lg:col-span-2 p-6", eyebrow: "04 \u00B7 failed", value: c.deliveriesByStatus.FAILED ?? 0, tone: c.deliveriesByStatus.FAILED ?? 0 > 0 ? 'err' : undefined })] }), _jsx("div", { className: "surface p-6", children: _jsx(ProgressBar, { value: c.sentCount + c.failedCount, max: c.totalRecipients, segments: 80, label: `procesados ${c.sentCount + c.failedCount}/${c.totalRecipients}` }) })] })), _jsxs("section", { children: [_jsx("div", { className: "divider-label mb-4", children: "delivery log" }), _jsx("div", { className: "surface overflow-hidden", children: _jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "phone" }), _jsx("th", { children: "name" }), _jsx("th", { children: "status" }), _jsx("th", { children: "error" }), _jsx("th", { children: "sent at" })] }) }), _jsxs("tbody", { children: [deliveries.data?.items.map((d) => (_jsxs("tr", { children: [_jsx("td", { className: "font-mono text-xs", children: d.contact.phoneE164 }), _jsx("td", { children: d.contact.name ?? _jsx("span", { className: "text-ink-dim", children: "\u2014" }) }), _jsx("td", { children: _jsx(Badge, { children: d.status }) }), _jsx("td", { className: "text-2xs font-mono text-signal-err", children: d.errorMessage ?? '' }), _jsx("td", { className: "text-2xs font-mono text-ink-muted", children: d.sentAt ? new Date(d.sentAt).toLocaleTimeString() : '' })] }, d.id))), deliveries.data?.items.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "text-center py-12 text-2xs uppercase tracking-widest font-mono text-ink-muted", children: "\u2014 sin env\u00EDos a\u00FAn \u2014" }) }))] })] }) })] })] }));
}
function Stat({ className, eyebrow, value, big, accent, tone, }) {
    const color = accent
        ? 'text-accent'
        : tone === 'ok'
            ? 'text-signal-ok'
            : tone === 'err'
                ? 'text-signal-err'
                : tone === 'warn'
                    ? 'text-signal-warn'
                    : 'text-ink-primary';
    return (_jsxs("div", { className: `bg-canvas-elevated ${className}`, children: [_jsx("p", { className: "section-eyebrow", children: eyebrow }), _jsx("p", { className: `font-display ${big ? 'text-7xl' : 'text-4xl'} mt-3 leading-none tabular ${color}`, children: value })] }));
}
