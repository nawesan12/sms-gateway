import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { devicesApi } from '@/api/devices';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
export function DevicesPage() {
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', textbeeDeviceId: '', apiKey: '', priority: 100 });
    const list = useQuery({ queryKey: ['devices'], queryFn: devicesApi.list, refetchInterval: 10_000 });
    const create = useMutation({
        mutationFn: devicesApi.create,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['devices'] });
            setShowCreate(false);
            setForm({ name: '', textbeeDeviceId: '', apiKey: '', priority: 100 });
        },
    });
    const remove = useMutation({
        mutationFn: (id) => devicesApi.remove(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
    });
    const reactivate = useMutation({
        mutationFn: (id) => devicesApi.update(id, { status: 'ACTIVE' }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
    });
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("header", { className: "flex items-end justify-between border-b border-line pb-6", children: [_jsxs("div", { children: [_jsx("p", { className: "section-eyebrow mb-2", children: "\u2014 hardware fleet \u00B7 TextBee" }), _jsxs("h1", { className: "font-display text-6xl leading-none", children: ["Devices", _jsx("span", { className: "text-accent", children: "." })] })] }), _jsx(Button, { onClick: () => setShowCreate(true), children: "+ Register" })] }), list.data && list.data.items.length === 0 ? (_jsx(EmptyState, { title: "Sin dispositivos", hint: "Registr\u00E1 un Android para empezar a transmitir SMS.", action: _jsx(Button, { onClick: () => setShowCreate(true), children: "Registrar primero" }) })) : (_jsx("div", { className: "surface overflow-hidden", children: _jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "name" }), _jsx("th", { children: "textbee id" }), _jsx("th", { children: "status" }), _jsx("th", { children: "circuit" }), _jsx("th", { children: "prio" }), _jsx("th", { children: "battery" }), _jsx("th", { className: "text-right", children: "actions" })] }) }), _jsx("tbody", { children: list.data?.items.map((d) => (_jsxs("tr", { children: [_jsx("td", { children: _jsx("span", { className: "font-medium text-ink-primary", children: d.name }) }), _jsx("td", { className: "font-mono text-xs text-ink-secondary", children: d.textbeeDeviceId }), _jsx("td", { children: _jsx(Badge, { children: d.status }) }), _jsx("td", { children: _jsx(Badge, { children: d.circuitState }) }), _jsx("td", { className: "font-mono text-ink-secondary tabular", children: d.priority }), _jsx("td", { className: "font-mono text-ink-secondary tabular", children: d.batteryLevel != null ? `${d.batteryLevel}%` : '—' }), _jsx("td", { className: "text-right", children: _jsxs("div", { className: "flex justify-end gap-1.5", children: [d.status !== 'ACTIVE' && (_jsx(Button, { variant: "secondary", onClick: () => reactivate.mutate(d.id), children: "revive" })), _jsx(Button, { variant: "danger", onClick: () => {
                                                        if (confirm(`Eliminar ${d.name}?`))
                                                            remove.mutate(d.id);
                                                    }, children: "delete" })] }) })] }, d.id))) })] }) })), _jsx(Modal, { open: showCreate, onClose: () => setShowCreate(false), eyebrow: "/ register hardware", title: "Nuevo dispositivo", footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "secondary", onClick: () => setShowCreate(false), children: "cancel" }), _jsx(Button, { loading: create.isPending, onClick: () => create.mutate(form), disabled: !form.name || !form.textbeeDeviceId || !form.apiKey, children: "register" })] }), children: _jsxs("div", { className: "space-y-4", children: [_jsx(Input, { label: "Nombre", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), placeholder: "phone-mardelplata-1" }), _jsx(Input, { label: "TextBee device id", value: form.textbeeDeviceId, onChange: (e) => setForm({ ...form, textbeeDeviceId: e.target.value }), className: "input-mono" }), _jsx(Input, { label: "API key", type: "password", value: form.apiKey, onChange: (e) => setForm({ ...form, apiKey: e.target.value }), className: "input-mono", hint: "se cifra con AES-256-GCM antes de guardarse" }), _jsx(Input, { label: "Prioridad (menor = m\u00E1s usado)", type: "number", value: form.priority, onChange: (e) => setForm({ ...form, priority: Number(e.target.value) }) }), create.isError && (_jsx("p", { className: "text-2xs font-mono text-signal-err", children: create.error.message }))] }) })] }));
}
