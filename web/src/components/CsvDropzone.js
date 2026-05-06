import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
export function CsvDropzone({ onFile, disabled }) {
    const inputRef = useRef(null);
    const [drag, setDrag] = useState(false);
    const readFile = (file) => {
        const reader = new FileReader();
        reader.onload = () => onFile(String(reader.result ?? ''));
        reader.readAsText(file);
    };
    return (_jsxs("div", { onDragOver: (e) => {
            e.preventDefault();
            setDrag(true);
        }, onDragLeave: () => setDrag(false), onDrop: (e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f)
                readFile(f);
        }, onClick: () => inputRef.current?.click(), className: `relative cursor-pointer flex flex-col items-center justify-center px-6 py-12 text-center
        border border-dashed transition-colors
        ${disabled ? 'opacity-40 pointer-events-none' : ''}
        ${drag ? 'border-accent bg-accent/5' : 'border-line-strong bg-canvas-input hover:bg-canvas-overlay'}`, children: [_jsx("div", { className: "absolute inset-2 pointer-events-none crosshair opacity-30" }), _jsxs("div", { className: "relative", children: [_jsx("p", { className: "section-eyebrow mb-2", children: "CSV upload" }), _jsx("p", { className: "font-display text-2xl text-ink-primary", children: "Arrastr\u00E1 un archivo" }), _jsx("p", { className: "mt-2 text-2xs font-mono uppercase tracking-widest text-ink-muted", children: "o click para elegir \u00B7 columnas: phone (req), name, email" })] }), _jsx("input", { ref: inputRef, type: "file", accept: ".csv,text/csv", className: "hidden", onChange: (e) => {
                    const f = e.target.files?.[0];
                    if (f)
                        readFile(f);
                    e.target.value = '';
                } })] }));
}
