import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken } from '@/api/client';
const NAV = [
    { to: '/', index: '01', label: 'Dashboard', exact: true },
    { to: '/send', index: '02', label: 'Send SMS' },
    { to: '/contacts', index: '03', label: 'Contacts' },
    { to: '/lists', index: '04', label: 'Lists' },
    { to: '/campaigns', index: '05', label: 'Campaigns' },
    { to: '/devices', index: '06', label: 'Devices' },
];
export function Layout() {
    const navigate = useNavigate();
    return (_jsxs("div", { className: "flex min-h-screen", children: [_jsxs("aside", { className: "w-64 shrink-0 border-r border-line bg-canvas/60 backdrop-blur flex flex-col sticky top-0 h-screen", children: [_jsxs("div", { className: "px-6 py-6 border-b border-line", children: [_jsx("p", { className: "text-2xs uppercase tracking-widest font-mono text-ink-muted", children: "\u25C7 \u00A0Operator console" }), _jsxs("h1", { className: "mt-1 font-display text-3xl leading-none", children: ["SMS", _jsx("span", { className: "text-accent", children: "." }), _jsx("span", { className: "italic", children: " gateway" })] }), _jsxs("div", { className: "mt-3 flex items-center gap-2", children: [_jsx("span", { className: "relative inline-block w-1.5 h-1.5 rounded-full bg-signal-ok", children: _jsx("span", { className: "absolute inset-0 rounded-full bg-signal-ok animate-pulse-dot" }) }), _jsx("span", { className: "text-2xs uppercase tracking-widest font-mono text-ink-secondary", children: "online" })] })] }), _jsx("nav", { className: "flex flex-col py-3 px-3 gap-0.5 flex-1 overflow-y-auto", children: NAV.map((n) => (_jsx(NavLink, { to: n.to, end: n.exact, className: ({ isActive }) => `group relative flex items-center gap-3 px-3 py-2.5 transition-colors ${isActive
                                ? 'bg-canvas-overlay text-ink-primary'
                                : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-overlay/50'}`, children: ({ isActive }) => (_jsxs(_Fragment, { children: [_jsx("span", { className: `text-2xs font-mono tracking-widest ${isActive ? 'text-accent' : 'text-ink-muted'}`, children: n.index }), _jsx("span", { className: "text-sm font-medium tracking-wide", children: n.label }), isActive && (_jsx("span", { className: "absolute left-0 top-1.5 bottom-1.5 w-px bg-accent" }))] })) }, n.to))) }), _jsx("div", { className: "px-3 py-3 border-t border-line", children: _jsx("button", { onClick: () => {
                                clearToken();
                                navigate('/login');
                            }, className: "w-full text-left text-2xs uppercase tracking-widest font-mono text-ink-muted hover:text-signal-err px-3 py-2 transition-colors", children: "\u21B3 Sign out" }) }), _jsxs("div", { className: "px-6 py-4 border-t border-line", children: [_jsx("p", { className: "text-2xs font-mono text-ink-dim", children: "v0.1.0" }), _jsx("p", { className: "text-2xs font-mono text-ink-dim mt-0.5", children: "textbee \u00B7 android" })] })] }), _jsx("main", { className: "flex-1 px-10 py-8 max-w-[1500px]", children: _jsx("div", { className: "animate-fade-up", children: _jsx(Outlet, {}) }) })] }));
}
