import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignsApi } from '@/api/campaigns';
import { listsApi } from '@/api/lists';
import { Button } from '@/components/Button';
import { Input, Textarea } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { ProgressBar } from '@/components/ProgressBar';
import { EmptyState } from '@/components/EmptyState';
export function CampaignsPage() {
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', messageTemplate: '', listId: '', tpsLimit: 1 });
    const list = useQuery({
        queryKey: ['campaigns'],
        queryFn: () => campaignsApi.list({ pageSize: 100 }),
        refetchInterval: 3_000,
    });
    const lists = useQuery({ queryKey: ['lists'], queryFn: listsApi.list, enabled: showCreate });
    const create = useMutation({
        mutationFn: campaignsApi.create,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['campaigns'] });
            setShowCreate(false);
            setForm({ name: '', messageTemplate: '', listId: '', tpsLimit: 1 });
        },
    });
    const launch = useMutation({
        mutationFn: (id) => campaignsApi.launch(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
    });
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("header", { className: "flex items-end justify-between border-b border-line pb-6", children: [_jsxs("div", { children: [_jsxs("p", { className: "section-eyebrow mb-2", children: ["\u2014 broadcast queue \u00B7 ", list.data?.total ?? 0] }), _jsxs("h1", { className: "font-display text-6xl leading-none", children: ["Campa\u00F1as", _jsx("span", { className: "text-accent", children: "." })] })] }), _jsx(Button, { onClick: () => setShowCreate(true), children: "+ Nueva" })] }), list.data && list.data.items.length === 0 ? (_jsx(EmptyState, { title: "Sin campa\u00F1as", hint: "Redact\u00E1 un mensaje, eleg\u00ED una lista y lanz\u00E1.", action: _jsx(Button, { onClick: () => setShowCreate(true), children: "Crear" }) })) : (_jsx("div", { className: "space-y-2 stagger", children: list.data?.items.map((c, idx) => (_jsxs("div", { className: "surface p-5 hover:bg-canvas-overlay transition-colors group", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-3 mb-1", children: [_jsx("span", { className: "text-2xs font-mono tracking-widest text-ink-dim", children: String(idx + 1).padStart(2, '0') }), _jsx(Link, { to: `/campaigns/${c.id}`, className: "font-display text-2xl text-ink-primary group-hover:text-accent transition-colors", children: c.name }), _jsx(Badge, { children: c.status })] }), _jsxs("p", { className: "text-xs text-ink-muted truncate font-mono pl-9", children: ["> ", c.messageTemplate] })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [c.status === 'DRAFT' && (_jsx(Button, { onClick: () => launch.mutate(c.id), loading: launch.isPending, children: "\u25B6 Lanzar" })), _jsx(Link, { to: `/campaigns/${c.id}`, className: "btn-secondary", children: "open \u2192" })] })] }), c.totalRecipients > 0 && (_jsx("div", { className: "mt-4 pl-9", children: _jsx(ProgressBar, { value: c.sentCount + c.failedCount, max: c.totalRecipients, segments: 64, label: `sent ${c.sentCount} · failed ${c.failedCount}` }) }))] }, c.id))) })), _jsx(Modal, { open: showCreate, onClose: () => setShowCreate(false), eyebrow: "/ new broadcast", title: "Nueva campa\u00F1a", size: "lg", footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "secondary", onClick: () => setShowCreate(false), children: "cancel" }), _jsx(Button, { loading: create.isPending, disabled: !form.name || !form.messageTemplate || !form.listId, onClick: () => create.mutate({
                                name: form.name,
                                messageTemplate: form.messageTemplate,
                                listId: form.listId,
                                tpsLimit: form.tpsLimit,
                            }), children: "create draft" })] }), children: _jsxs("div", { className: "space-y-4", children: [_jsx(Input, { label: "Nombre", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), placeholder: "Promo Black Friday" }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Lista de destinatarios" }), _jsxs("select", { className: "input", value: form.listId, onChange: (e) => setForm({ ...form, listId: e.target.value }), children: [_jsx("option", { value: "", children: "\u2014 eleg\u00ED una lista \u2014" }), lists.data?.items.map((l) => (_jsxs("option", { value: l.id, children: [l.name, " \u00B7 ", l.memberCount, " contacts"] }, l.id)))] })] }), _jsx(Textarea, { label: "Mensaje \u00B7 libre", rows: 5, maxLength: 1600, value: form.messageTemplate, onChange: (e) => setForm({ ...form, messageTemplate: e.target.value }), placeholder: "Hola {{name}}, lleg\u00F3 tu pedido.", hint: `variables: {{name}}, {{phone}} · ${form.messageTemplate.length}/1600 chars`, className: "font-mono" }), _jsx(Input, { label: "TPS \u00B7 SMS por segundo", type: "number", min: 1, max: 50, value: form.tpsLimit, onChange: (e) => setForm({ ...form, tpsLimit: Number(e.target.value) }), hint: "default 1/s \u00B7 evita quemar la SIM y parecer spam" }), create.isError && (_jsx("p", { className: "text-2xs font-mono text-signal-err", children: create.error.message }))] }) })] }));
}
