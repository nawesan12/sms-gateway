import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken } from '@/api/client';

const NAV: { to: string; label: string; index: string; exact?: boolean }[] = [
  { to: '/',          index: '01', label: 'Dashboard',  exact: true },
  { to: '/send',      index: '02', label: 'Send SMS' },
  { to: '/contacts',  index: '03', label: 'Contacts' },
  { to: '/lists',     index: '04', label: 'Lists' },
  { to: '/campaigns', index: '05', label: 'Campaigns' },
  { to: '/devices',   index: '06', label: 'Devices' },
];

export function Layout() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen">
      {/* ─── Sidebar ─── */}
      <aside className="w-64 shrink-0 border-r border-line bg-canvas/60 backdrop-blur flex flex-col sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-line">
          <p className="text-2xs uppercase tracking-widest font-mono text-ink-muted">
            ◇ &nbsp;Operator console
          </p>
          <h1 className="mt-1 font-display text-3xl leading-none">
            SMS<span className="text-accent">.</span>
            <span className="italic"> gateway</span>
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-signal-ok">
              <span className="absolute inset-0 rounded-full bg-signal-ok animate-pulse-dot" />
            </span>
            <span className="text-2xs uppercase tracking-widest font-mono text-ink-secondary">
              online
            </span>
          </div>
        </div>

        <nav className="flex flex-col py-3 px-3 gap-0.5 flex-1 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.exact}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2.5 transition-colors ${
                  isActive
                    ? 'bg-canvas-overlay text-ink-primary'
                    : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-overlay/50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`text-2xs font-mono tracking-widest ${
                      isActive ? 'text-accent' : 'text-ink-muted'
                    }`}
                  >
                    {n.index}
                  </span>
                  <span className="text-sm font-medium tracking-wide">{n.label}</span>
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-px bg-accent" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-line">
          <button
            onClick={() => {
              clearToken();
              navigate('/login');
            }}
            className="w-full text-left text-2xs uppercase tracking-widest font-mono text-ink-muted hover:text-signal-err px-3 py-2 transition-colors"
          >
            ↳ Sign out
          </button>
        </div>

        <div className="px-6 py-4 border-t border-line">
          <p className="text-2xs font-mono text-ink-dim">v0.1.0</p>
          <p className="text-2xs font-mono text-ink-dim mt-0.5">textbee · android</p>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <main className="flex-1 px-10 py-8 max-w-[1500px]">
        <div className="animate-fade-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
