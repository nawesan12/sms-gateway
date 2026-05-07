import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { setToken } from '@/api/client';
export function LoginPage() {
    const navigate = useNavigate();
    const [token, setT] = useState('');
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    // Auto-login desde el link de acceso: /login?token=XYZ
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const linkToken = params.get('token');
        if (!linkToken)
            return;
        setToken(linkToken.trim());
        // Limpiar la URL para que el token no quede en history.
        window.history.replaceState({}, '', '/login');
        navigate('/', { replace: true });
    }, [navigate]);
    const submit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!token.trim()) {
            setError('Ingresá un token');
            return;
        }
        setSubmitting(true);
        setToken(token.trim());
        const isViteDev = import.meta.env.DEV && location.port === '5173';
        const url = isViteDev ? '/api/v1/devices' : '/v1/devices';
        try {
            // Probamos como Bearer (access token o JWT) y como bootstrap a la vez.
            const res = await fetch(url, {
                headers: {
                    'x-bootstrap-token': token.trim(),
                    authorization: `Bearer ${token.trim()}`,
                },
            });
            if (!res.ok) {
                setError('Token inválido');
                setSubmitting(false);
                return;
            }
            navigate('/');
        }
        catch {
            setError('No se puede contactar la API');
            setSubmitting(false);
        }
    };
    return (_jsxs("div", { className: "min-h-screen relative grid lg:grid-cols-[1.2fr_1fr]", children: [_jsxs("section", { className: "relative flex flex-col justify-between p-10 lg:p-14 overflow-hidden border-r border-line", children: [_jsx("div", { className: "absolute inset-0 crosshair opacity-40 pointer-events-none" }), _jsx("div", { className: "absolute -top-20 -left-20 w-[480px] h-[480px] bg-accent/[0.06] blur-3xl rounded-full pointer-events-none" }), _jsxs("header", { className: "relative flex items-center justify-between text-2xs uppercase tracking-widest font-mono text-ink-muted", children: [_jsx("span", { children: "\u25C7 \u00A0sms.gateway / operator console" }), _jsx("span", { children: "v0.1.0" })] }), _jsxs("div", { className: "relative max-w-2xl", children: [_jsx("p", { className: "section-eyebrow mb-6", children: "\u2014 LATAM bulk SMS \u00B7 TextBee \u00D7 Android" }), _jsxs("h1", { className: "font-display text-6xl lg:text-8xl leading-[0.95] text-ink-primary text-balance", children: ["Mand\u00E1 SMS a", _jsx("br", {}), _jsx("span", { className: "italic", children: "miles de" }), " contactos.", _jsx("span", { className: "text-accent", children: "." })] }), _jsx("p", { className: "mt-6 text-base text-ink-secondary max-w-md leading-relaxed", children: "Listas. Campa\u00F1as. Templates. Todo desde un Android f\u00EDsico. Sin Twilio. Sin minutos. Costos de la SIM y nada m\u00E1s." }), _jsx("div", { className: "mt-10 grid grid-cols-3 gap-px bg-line max-w-md", children: [
                                    { k: 'tps', v: '5/s' },
                                    { k: 'devices', v: 'multi' },
                                    { k: 'failover', v: 'auto' },
                                ].map((s) => (_jsxs("div", { className: "bg-canvas px-4 py-3", children: [_jsx("p", { className: "text-2xs uppercase tracking-widest font-mono text-ink-muted", children: s.k }), _jsx("p", { className: "font-display text-2xl text-ink-primary mt-0.5", children: s.v })] }, s.k))) })] }), _jsxs("footer", { className: "relative flex justify-between text-2xs uppercase tracking-widest font-mono text-ink-dim", children: [_jsx("span", { children: "buenos aires \u00B7 mar del plata" }), _jsxs("span", { className: "flex items-center gap-2", children: ["status", _jsx("span", { className: "relative inline-block w-1.5 h-1.5 rounded-full bg-signal-ok", children: _jsx("span", { className: "absolute inset-0 rounded-full bg-signal-ok animate-pulse-dot" }) }), "ok"] })] })] }), _jsx("section", { className: "flex items-center justify-center p-10 bg-canvas-elevated/40", children: _jsxs("form", { onSubmit: submit, className: "w-full max-w-md space-y-6 stagger", children: [_jsxs("div", { children: [_jsx("p", { className: "section-eyebrow mb-2", children: "/ authentication" }), _jsxs("h2", { className: "font-display text-4xl leading-tight", children: ["Acceso de operador", _jsx("span", { className: "inline-block ml-1 w-3 h-7 bg-accent animate-blink align-middle" })] }), _jsx("p", { className: "mt-2 text-sm text-ink-secondary", children: "Peg\u00E1 tu bootstrap token. Si no lo ten\u00E9s, pedile uno al admin." })] }), _jsx(Input, { label: "Bootstrap token", type: "password", autoComplete: "off", autoFocus: true, value: token, onChange: (e) => setT(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", error: error ?? undefined, className: "input-mono" }), _jsxs(Button, { type: "submit", loading: submitting, className: "w-full justify-between", children: [_jsx("span", { children: "Entrar" }), _jsx("span", { className: "text-accent-fg/60", children: "\u2192" })] }), _jsxs("div", { className: "border-t border-line pt-4 text-2xs uppercase tracking-widest font-mono text-ink-muted leading-relaxed", children: [_jsx("p", { children: "tip \u00B7 header `x-bootstrap-token`" }), _jsx("p", { children: "tip \u00B7 session vive en localStorage" })] })] }) })] }));
}
