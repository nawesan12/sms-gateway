import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '@/api/contacts';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { CsvDropzone } from '@/components/CsvDropzone';
import { EmptyState } from '@/components/EmptyState';
export function ContactsPage() {
    const qc = useQueryClient();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [form, setForm] = useState({ phone: '', name: '', email: '' });
    const [importResult, setImportResult] = useState(null);
    const list = useQuery({
        queryKey: ['contacts', search, page],
        queryFn: () => contactsApi.list({ search: search || undefined, page, pageSize: 20 }),
    });
    const create = useMutation({
        mutationFn: contactsApi.create,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['contacts'] });
            setShowCreate(false);
            setForm({ phone: '', name: '', email: '' });
        },
    });
    const remove = useMutation({
        mutationFn: (id) => contactsApi.remove(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
    });
    const importCsv = useMutation({
        mutationFn: contactsApi.importCsv,
        onSuccess: (summary) => {
            setImportResult(summary);
            qc.invalidateQueries({ queryKey: ['contacts'] });
        },
    });
    const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("header", { className: "flex items-end justify-between border-b border-line pb-6", children: [_jsxs("div", { children: [_jsxs("p", { className: "section-eyebrow mb-2", children: ["\u2014 directory \u00B7 ", list.data?.total ?? 0, " entries"] }), _jsxs("h1", { className: "font-display text-6xl leading-none", children: ["Contactos", _jsx("span", { className: "text-accent", children: "." })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => {
                                    setShowImport(true);
                                    setImportResult(null);
                                }, children: "\u2191 Import CSV" }), _jsx(Button, { onClick: () => setShowCreate(true), children: "+ Nuevo" })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-2xs uppercase tracking-widest font-mono text-ink-muted", children: "search" }), _jsx(Input, { placeholder: "nombre, tel\u00E9fono o email", value: search, onChange: (e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }, className: "flex-1 max-w-md" })] }), list.data && list.data.items.length === 0 ? (_jsx(EmptyState, { title: "Sin contactos", hint: "Carg\u00E1 uno o import\u00E1 un CSV." })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "surface overflow-hidden", children: _jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "phone" }), _jsx("th", { children: "name" }), _jsx("th", { children: "email" }), _jsx("th", { className: "text-right", children: "actions" })] }) }), _jsx("tbody", { children: list.data?.items.map((c) => (_jsxs("tr", { children: [_jsx("td", { className: "font-mono text-ink-primary", children: c.phoneE164 }), _jsx("td", { children: c.name ?? _jsx("span", { className: "text-ink-dim", children: "\u2014" }) }), _jsx("td", { className: "text-ink-secondary text-xs", children: c.email ?? _jsx("span", { className: "text-ink-dim", children: "\u2014" }) }), _jsx("td", { className: "text-right", children: _jsx(Button, { variant: "danger", onClick: () => {
                                                        if (confirm(`Borrar ${c.phoneE164}?`))
                                                            remove.mutate(c.id);
                                                    }, children: "delete" }) })] }, c.id))) })] }) }), totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-3 text-2xs uppercase tracking-widest font-mono", children: [_jsx(Button, { variant: "secondary", onClick: () => setPage(Math.max(1, page - 1)), disabled: page === 1, children: "\u2190 prev" }), _jsxs("span", { className: "text-ink-secondary", children: ["page ", _jsx("span", { className: "text-ink-primary tabular", children: page }), " /", ' ', _jsx("span", { className: "text-ink-secondary tabular", children: totalPages })] }), _jsx(Button, { variant: "secondary", onClick: () => setPage(Math.min(totalPages, page + 1)), disabled: page === totalPages, children: "next \u2192" })] }))] })), _jsx(Modal, { open: showCreate, onClose: () => setShowCreate(false), eyebrow: "/ new entry", title: "Nuevo contacto", footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "secondary", onClick: () => setShowCreate(false), children: "cancel" }), _jsx(Button, { loading: create.isPending, disabled: !form.phone, onClick: () => create.mutate({
                                phone: form.phone,
                                name: form.name || undefined,
                                email: form.email || undefined,
                            }), children: "save" })] }), children: _jsxs("div", { className: "space-y-4", children: [_jsx(Input, { label: "Tel\u00E9fono", value: form.phone, onChange: (e) => setForm({ ...form, phone: e.target.value }), className: "input-mono", placeholder: "+5491100000000" }), _jsx(Input, { label: "Nombre", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }) }), _jsx(Input, { label: "Email", type: "email", value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }) }), create.isError && (_jsx("p", { className: "text-2xs font-mono text-signal-err", children: create.error.message }))] }) }), _jsxs(Modal, { open: showImport, onClose: () => setShowImport(false), eyebrow: "/ bulk upload", title: "Importar CSV", size: "lg", children: [!importResult ? (_jsx(CsvDropzone, { disabled: importCsv.isPending, onFile: (csv) => importCsv.mutate(csv) })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-3 gap-px bg-line border border-line", children: [_jsxs("div", { className: "bg-canvas-elevated p-4", children: [_jsx("p", { className: "section-eyebrow", children: "imported" }), _jsx("p", { className: "font-display text-4xl text-signal-ok mt-1 tabular", children: importResult.imported })] }), _jsxs("div", { className: "bg-canvas-elevated p-4", children: [_jsx("p", { className: "section-eyebrow", children: "updated" }), _jsx("p", { className: "font-display text-4xl text-accent mt-1 tabular", children: importResult.updated })] }), _jsxs("div", { className: "bg-canvas-elevated p-4", children: [_jsx("p", { className: "section-eyebrow", children: "skipped" }), _jsx("p", { className: "font-display text-4xl text-signal-err mt-1 tabular", children: importResult.skipped })] })] }), importResult.errors.length > 0 && (_jsxs("div", { children: [_jsx("p", { className: "section-eyebrow mb-2", children: "errores" }), _jsx("div", { className: "surface-overlay max-h-48 overflow-y-auto divide-y divide-line", children: importResult.errors.map((e) => (_jsxs("div", { className: "px-3 py-2 text-2xs font-mono text-signal-err flex justify-between", children: [_jsxs("span", { children: ["row ", e.row, " \u00B7 ", e.phone || '(empty)'] }), _jsx("span", { className: "text-ink-muted", children: e.reason })] }, `${e.row}-${e.phone}`))) })] })), _jsx("div", { className: "flex justify-end pt-2", children: _jsx(Button, { onClick: () => {
                                        setShowImport(false);
                                        setImportResult(null);
                                    }, children: "done" }) })] })), importCsv.isError && (_jsx("p", { className: "mt-3 text-2xs font-mono text-signal-err", children: importCsv.error.message }))] })] }));
}
