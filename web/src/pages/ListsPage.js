import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listsApi } from '@/api/lists';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
export function ListsPage() {
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', description: '' });
    const list = useQuery({ queryKey: ['lists'], queryFn: listsApi.list });
    const create = useMutation({
        mutationFn: listsApi.create,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['lists'] });
            setShowCreate(false);
            setForm({ name: '', description: '' });
        },
    });
    const remove = useMutation({
        mutationFn: (id) => listsApi.remove(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
    });
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("header", { className: "flex items-end justify-between border-b border-line pb-6", children: [_jsxs("div", { children: [_jsx("p", { className: "section-eyebrow mb-2", children: "\u2014 audience segments" }), _jsxs("h1", { className: "font-display text-6xl leading-none", children: ["Listas", _jsx("span", { className: "text-accent", children: "." })] })] }), _jsx(Button, { onClick: () => setShowCreate(true), children: "+ Nueva" })] }), list.data && list.data.items.length === 0 ? (_jsx(EmptyState, { title: "Sin listas", hint: "Agrup\u00E1 contactos para mandarles campa\u00F1as." })) : (_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger", children: list.data?.items.map((l, idx) => (_jsxs(Link, { to: `/lists/${l.id}`, className: "surface block p-5 hover:bg-canvas-overlay group transition-colors", children: [_jsxs("div", { className: "flex items-start justify-between mb-3", children: [_jsx("span", { className: "text-2xs font-mono tracking-widest text-ink-dim", children: String(idx + 1).padStart(2, '0') }), _jsxs("span", { className: "text-2xs uppercase tracking-widest font-mono text-accent", children: [l.memberCount, " \u25C6"] })] }), _jsx("h3", { className: "font-display text-2xl text-ink-primary group-hover:text-accent transition-colors", children: l.name }), l.description && (_jsx("p", { className: "mt-1 text-sm text-ink-secondary line-clamp-2", children: l.description })), _jsxs("div", { className: "mt-4 flex items-center justify-between pt-3 border-t border-line", children: [_jsx("span", { className: "text-2xs uppercase tracking-widest font-mono text-ink-muted", children: l.memberCount === 1 ? 'contact' : 'contacts' }), _jsx("button", { onClick: (e) => {
                                        e.preventDefault();
                                        if (confirm(`Borrar "${l.name}"?`))
                                            remove.mutate(l.id);
                                    }, className: "text-2xs uppercase tracking-widest font-mono text-ink-muted hover:text-signal-err", children: "delete" })] })] }, l.id))) })), _jsx(Modal, { open: showCreate, onClose: () => setShowCreate(false), eyebrow: "/ new segment", title: "Nueva lista", footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "secondary", onClick: () => setShowCreate(false), children: "cancel" }), _jsx(Button, { loading: create.isPending, disabled: !form.name, onClick: () => create.mutate({ name: form.name, description: form.description || undefined }), children: "create" })] }), children: _jsxs("div", { className: "space-y-4", children: [_jsx(Input, { label: "Nombre", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), placeholder: "Clientes premium" }), _jsx(Input, { label: "Descripci\u00F3n", value: form.description, onChange: (e) => setForm({ ...form, description: e.target.value }), placeholder: "opcional" }), create.isError && (_jsx("p", { className: "text-2xs font-mono text-signal-err", children: create.error.message }))] }) })] }));
}
