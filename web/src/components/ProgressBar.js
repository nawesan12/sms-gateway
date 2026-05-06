import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Segmented progress bar — operator console style.
 * Each cell lights up when the cumulative pct reaches it.
 */
export function ProgressBar({ value, max, label, segments = 32 }) {
    const pct = max === 0 ? 0 : Math.min(100, (value / max) * 100);
    const filledCells = Math.round((pct / 100) * segments);
    return (_jsxs("div", { children: [label && (_jsxs("div", { className: "mb-2 flex justify-between items-baseline text-2xs uppercase tracking-widest font-mono", children: [_jsx("span", { className: "text-ink-muted", children: label }), _jsxs("span", { className: "text-ink-primary tabular", children: [value, "/", max, _jsxs("span", { className: "text-ink-muted ml-2", children: ["(", pct.toFixed(1), "%)"] })] })] })), _jsx("div", { className: "flex gap-[2px]", children: Array.from({ length: segments }).map((_, i) => {
                    const filled = i < filledCells;
                    return (_jsx("div", { className: `flex-1 h-2 transition-colors duration-200 ${filled ? 'bg-accent' : 'bg-line-subtle'}` }, i));
                }) })] }));
}
