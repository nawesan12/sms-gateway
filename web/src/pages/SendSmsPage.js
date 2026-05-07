import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { messagingApi } from '@/api/messaging';
import { contactsApi } from '@/api/contacts';
import { Button } from '@/components/Button';
import { Input, Textarea } from '@/components/Input';
import { Badge } from '@/components/Badge';
export function SendSmsPage() {
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [contactId, setContactId] = useState(null);
    const [search, setSearch] = useState('');
    const [lastSent, setLastSent] = useState(null);
    const contactsQ = useQuery({
        queryKey: ['contacts', 'picker', search],
        queryFn: () => contactsApi.list({ search, pageSize: 10 }),
        enabled: search.length > 0,
    });
    const sendStatus = useQuery({
        queryKey: ['sms', lastSent?.id],
        queryFn: () => messagingApi.status(lastSent.id),
        enabled: lastSent !== null,
        refetchInterval: 1500,
    });
    const send = useMutation({
        mutationFn: messagingApi.send,
        onSuccess: (out) => {
            setLastSent({ id: out.smsMessageId, phone: out.recipientE164 });
            setMessage('');
        },
    });
    const submit = (e) => {
        e.preventDefault();
        if (!phone.trim() || !message.trim())
            return;
        send.mutate({ phone: phone.trim(), message: message.trim(), contactId: contactId ?? undefined });
    };
    const charCount = message.length;
    const segments = Math.max(1, Math.ceil(charCount / 160));
    const charLimitColor = charCount > 1500 ? 'text-signal-err' : charCount > 160 ? 'text-signal-warn' : 'text-ink-muted';
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("header", { className: "border-b border-line pb-6", children: [_jsx("p", { className: "section-eyebrow mb-2", children: "\u2014 compose \u00B7 single recipient" }), _jsxs("h1", { className: "font-display text-6xl leading-none", children: ["Send ", _jsx("span", { className: "italic text-accent", children: "sms" }), "."] }), _jsx("p", { className: "mt-3 text-sm text-ink-secondary max-w-lg", children: "Mensaje libre. Sin templates. Lo que escribas ac\u00E1 llega tal cual al destinatario." })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-px bg-line border border-line", children: [_jsxs("form", { onSubmit: submit, className: "bg-canvas-elevated p-8 space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsx(Input, { label: "Tel\u00E9fono \u00B7 E.164", placeholder: "+5491100000000", value: phone, onChange: (e) => {
                                            setPhone(e.target.value);
                                            setContactId(null);
                                        }, className: "input-mono" }), _jsx(Input, { label: "O buscar contacto", placeholder: "nombre o n\u00FAmero", value: search, onChange: (e) => setSearch(e.target.value) })] }), contactsQ.data && contactsQ.data.items.length > 0 && search.length > 0 && (_jsx("div", { className: "surface-overlay max-h-44 overflow-y-auto divide-y divide-line", children: contactsQ.data.items.map((c) => (_jsxs("button", { type: "button", onClick: () => {
                                        setPhone(c.phoneE164);
                                        setContactId(c.id);
                                        setSearch('');
                                    }, className: "w-full px-3 py-2.5 text-left text-sm hover:bg-canvas/60 flex items-center gap-3", children: [_jsx("span", { className: "font-mono text-2xs text-ink-muted", children: "\u2192" }), _jsx("span", { className: "font-medium", children: c.name ?? '(sin nombre)' }), _jsx("span", { className: "font-mono text-xs text-ink-secondary ml-auto", children: c.phoneE164 })] }, c.id))) })), _jsx(Textarea, { label: "Mensaje", rows: 7, maxLength: 1600, value: message, onChange: (e) => setMessage(e.target.value), placeholder: "Escrib\u00ED el mensaje exacto que quer\u00E9s enviar...", className: "font-mono text-sm leading-relaxed" }), _jsxs("div", { className: "flex items-center justify-between text-2xs uppercase tracking-widest font-mono", children: [_jsxs("span", { className: charLimitColor, children: [charCount, "/1600 chars \u00B7 ", segments, " segment", segments > 1 ? 's' : ''] }), _jsx("span", { className: "text-ink-dim", children: "gsm-7 / utf-16 \u00B7 auto" })] }), send.isError && (_jsxs("p", { className: "text-2xs font-mono text-signal-err border border-signal-err/30 bg-signal-err/5 px-3 py-2", children: ["\u2715 \u00A0 ", send.error.message] })), _jsx(Button, { type: "submit", loading: send.isPending, disabled: !phone || !message, children: "Transmitir \u2192" })] }), _jsxs("div", { className: "bg-canvas/60 p-8 relative", children: [_jsx("p", { className: "section-eyebrow", children: "/ last transmission" }), !lastSent ? (_jsxs("div", { className: "mt-12 text-center", children: [_jsxs("p", { className: "font-display text-3xl text-ink-muted leading-tight", children: ["Sin env\u00EDos", _jsx("br", {}), "en esta sesi\u00F3n"] }), _jsx("p", { className: "mt-3 text-2xs font-mono uppercase tracking-widest text-ink-dim", children: "el resultado va a aparecer ac\u00E1 \u2198" })] })) : (_jsxs("div", { className: "mt-4 space-y-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-2xs uppercase tracking-widest font-mono text-ink-muted", children: "recipient" }), _jsx("p", { className: "font-mono text-lg text-ink-primary mt-0.5", children: lastSent.phone })] }), _jsxs("div", { children: [_jsx("p", { className: "text-2xs uppercase tracking-widest font-mono text-ink-muted", children: "status" }), _jsx("div", { className: "mt-1.5", children: _jsx(Badge, { children: sendStatus.data?.status ?? 'PENDING' }) })] }), sendStatus.data?.textbeeMessageId && (_jsxs("div", { children: [_jsx("p", { className: "text-2xs uppercase tracking-widest font-mono text-ink-muted", children: "provider id" }), _jsx("p", { className: "font-mono text-xs text-ink-secondary mt-0.5 break-all", children: sendStatus.data.textbeeMessageId })] })), sendStatus.data?.errorMessage && (_jsxs("div", { children: [_jsx("p", { className: "text-2xs uppercase tracking-widest font-mono text-signal-err", children: "error" }), _jsx("p", { className: "font-mono text-xs text-signal-err mt-0.5", children: sendStatus.data.errorMessage })] })), _jsx("div", { className: "pt-4 border-t border-line", children: _jsxs("p", { className: "text-2xs font-mono text-ink-dim", children: ["msgId \u00B7 ", _jsx("span", { className: "text-ink-secondary break-all", children: lastSent.id })] }) })] }))] })] })] }));
}
