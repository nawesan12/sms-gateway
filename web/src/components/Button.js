import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const VARIANT_CLASS = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
};
export function Button({ variant = 'primary', loading, children, disabled, className, ...rest }) {
    return (_jsx("button", { ...rest, disabled: disabled || loading, className: `${VARIANT_CLASS[variant]} ${className ?? ''}`, children: loading ? (_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx("span", { className: "w-1 h-1 rounded-full bg-current animate-pulse-dot" }), _jsx("span", { className: "w-1 h-1 rounded-full bg-current animate-pulse-dot [animation-delay:200ms]" }), _jsx("span", { className: "w-1 h-1 rounded-full bg-current animate-pulse-dot [animation-delay:400ms]" })] })) : (children) }));
}
