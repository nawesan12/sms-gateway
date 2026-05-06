import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const SIZE = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
};
export function Modal({ open, onClose, title, eyebrow, children, footer, size = 'md' }) {
    if (!open)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-up", onClick: onClose, children: _jsxs("div", { className: `surface w-full ${SIZE[size]} max-h-[90vh] flex flex-col`, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-start justify-between border-b border-line px-5 py-4", children: [_jsxs("div", { children: [eyebrow && _jsx("p", { className: "section-eyebrow mb-1", children: eyebrow }), _jsx("h2", { className: "font-display text-2xl text-ink-primary leading-none", children: title })] }), _jsx("button", { onClick: onClose, "aria-label": "Cerrar", className: "text-ink-muted hover:text-ink-primary text-xl leading-none px-2", children: "\u00D7" })] }), _jsx("div", { className: "overflow-y-auto px-5 py-5", children: children }), footer && (_jsx("div", { className: "border-t border-line px-5 py-3.5 flex justify-end gap-2 bg-canvas/40", children: footer }))] }) }));
}
