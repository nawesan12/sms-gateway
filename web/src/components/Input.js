import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Input({ label, error, hint, prefix, className, ...rest }) {
    return (_jsxs("div", { children: [label && _jsx("label", { className: "label", children: label }), _jsxs("div", { className: prefix ? 'flex' : '', children: [prefix && (_jsx("span", { className: "flex items-center px-3 bg-canvas-overlay border border-line border-r-0 text-2xs uppercase tracking-widest font-mono text-ink-muted", children: prefix })), _jsx("input", { ...rest, className: `input ${className ?? ''}` })] }), hint && !error && _jsx("p", { className: "mt-1.5 text-2xs font-mono text-ink-muted", children: hint }), error && _jsx("p", { className: "mt-1.5 text-2xs font-mono text-signal-err", children: error })] }));
}
export function Textarea({ label, error, hint, className, ...rest }) {
    return (_jsxs("div", { children: [label && _jsx("label", { className: "label", children: label }), _jsx("textarea", { ...rest, className: `input resize-y ${className ?? ''}` }), hint && !error && _jsx("p", { className: "mt-1.5 text-2xs font-mono text-ink-muted", children: hint }), error && _jsx("p", { className: "mt-1.5 text-2xs font-mono text-signal-err", children: error })] }));
}
