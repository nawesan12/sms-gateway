import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listsApi } from '@/api/lists';
import { contactsApi } from '@/api/contacts';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
export function ListDetailPage() {
    const qc = useQueryClient();
    const { id = '' } = useParams();
    const [showAdd, setShowAdd] = useState(false);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(new Set());
    const list = useQuery({
        queryKey: ['list', id],
        queryFn: () => listsApi.getById(id),
        enabled: !!id,
    });
    const members = useQuery({
        queryKey: ['list', id, 'members'],
        queryFn: () => listsApi.members(id, { pageSize: 200 }),
        enabled: !!id,
    });
    const candidates = useQuery({
        queryKey: ['contacts', 'add-to-list', search],
        queryFn: () => contactsApi.list({ search: search || undefined, pageSize: 100 }),
        enabled: showAdd,
    });
    const add = useMutation({
        mutationFn: (ids) => listsApi.addMembers(id, ids),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['list', id] });
            qc.invalidateQueries({ queryKey: ['lists'] });
            setShowAdd(false);
            setSelected(new Set());
        },
    });
    const removeMember = useMutation({
        mutationFn: (contactId) => listsApi.removeMember(id, contactId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['list', id] });
            qc.invalidateQueries({ queryKey: ['lists'] });
        },
    });
    const memberIds = new Set(members.data?.items.map((m) => m.id) ?? []);
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx(Link, { to: "/lists", className: "text-2xs uppercase tracking-widest font-mono text-ink-muted hover:text-accent", children: "\u2190 listas" }), _jsxs("header", { className: "mt-2 flex items-end justify-between border-b border-line pb-6", children: [_jsxs("div", { children: [_jsxs("p", { className: "section-eyebrow mb-2", children: ["\u2014 segment \u00B7 ", members.data?.total ?? 0, " contactos"] }), _jsx("h1", { className: "font-display text-5xl leading-none", children: list.data?.name ?? '...' }), list.data?.description && (_jsx("p", { className: "mt-2 text-sm text-ink-secondary max-w-xl", children: list.data.description }))] }), _jsx(Button, { onClick: () => setShowAdd(true), children: "+ Agregar contactos" })] })] }), _jsx("div", { className: "surface overflow-hidden", children: _jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "phone" }), _jsx("th", { children: "name" }), _jsx("th", { className: "text-right", children: "action" })] }) }), _jsxs("tbody", { children: [members.data?.items.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 3, className: "text-center py-12 text-2xs uppercase tracking-widest font-mono text-ink-muted", children: "\u2014 lista vac\u00EDa. agreg\u00E1 contactos. \u2014" }) })), members.data?.items.map((c) => (_jsxs("tr", { children: [_jsx("td", { className: "font-mono text-ink-primary", children: c.phoneE164 }), _jsx("td", { children: c.name ?? _jsx("span", { className: "text-ink-dim", children: "\u2014" }) }), _jsx("td", { className: "text-right", children: _jsx(Button, { variant: "danger", onClick: () => removeMember.mutate(c.id), children: "quitar" }) })] }, c.id)))] })] }) }), _jsx(Modal, { open: showAdd, onClose: () => {
                    setShowAdd(false);
                    setSelected(new Set());
                }, eyebrow: "/ add to segment", title: "Agregar contactos", size: "lg", footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "secondary", onClick: () => {
                                setShowAdd(false);
                                setSelected(new Set());
                            }, children: "cancel" }), _jsxs(Button, { loading: add.isPending, disabled: selected.size === 0, onClick: () => add.mutate([...selected]), children: ["add", selected.size > 0 ? ` (${selected.size})` : ''] })] }), children: _jsxs("div", { className: "space-y-4", children: [_jsx(Input, { placeholder: "buscar contactos...", value: search, onChange: (e) => setSearch(e.target.value) }), _jsxs("div", { className: "surface-overlay max-h-80 overflow-y-auto divide-y divide-line", children: [candidates.data?.items.map((c) => {
                                    const already = memberIds.has(c.id);
                                    const checked = selected.has(c.id);
                                    return (_jsxs("label", { className: `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${already ? 'opacity-40' : 'cursor-pointer hover:bg-canvas-overlay'}`, children: [_jsx("input", { type: "checkbox", disabled: already, checked: already || checked, onChange: (e) => {
                                                    const next = new Set(selected);
                                                    if (e.target.checked)
                                                        next.add(c.id);
                                                    else
                                                        next.delete(c.id);
                                                    setSelected(next);
                                                }, className: "accent-accent" }), _jsx("span", { className: "font-mono text-ink-primary", children: c.phoneE164 }), _jsx("span", { className: "text-ink-secondary", children: c.name ?? '—' }), already && (_jsx("span", { className: "ml-auto text-2xs uppercase tracking-widest font-mono text-ink-dim", children: "ya en lista" }))] }, c.id));
                                }), candidates.data?.items.length === 0 && (_jsx("p", { className: "px-4 py-6 text-center text-2xs uppercase tracking-widest font-mono text-ink-muted", children: "\u2014 sin resultados \u2014" }))] }), add.isError && (_jsx("p", { className: "text-2xs font-mono text-signal-err", children: add.error.message }))] }) })] }));
}
