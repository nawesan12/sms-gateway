import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/api/stats';
import { devicesApi } from '@/api/devices';
import { campaignsApi } from '@/api/campaigns';
import { Badge } from '@/components/Badge';
import { ProgressBar } from '@/components/ProgressBar';

export function DashboardPage() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: statsApi.get, refetchInterval: 5_000 });
  const devices = useQuery({ queryKey: ['devices'], queryFn: devicesApi.list });
  const running = useQuery({
    queryKey: ['campaigns', 'running'],
    queryFn: () => campaignsApi.list({ pageSize: 6 }),
    refetchInterval: 3_000,
  });

  const activeDevices = devices.data?.items.filter((d) => d.status === 'ACTIVE').length ?? 0;
  const totalDevices = devices.data?.items.length ?? 0;
  const sent = stats.data?.sms.sent ?? 0;
  const failed = stats.data?.sms.failed ?? 0;
  const total = stats.data?.sms.total ?? 0;
  const failureRate = total === 0 ? 0 : (failed / total) * 100;

  return (
    <div className="space-y-10">
      {/* ─── Header ─── */}
      <header className="flex items-end justify-between border-b border-line pb-6">
        <div>
          <p className="section-eyebrow mb-2">— overview · last 24h</p>
          <h1 className="font-display text-6xl leading-none">
            Dashboard<span className="text-accent">.</span>
          </h1>
        </div>
        <div className="text-right text-2xs uppercase tracking-widest font-mono text-ink-muted">
          <p>
            {new Date().toLocaleDateString('es-AR', {
              weekday: 'long',
              day: '2-digit',
              month: 'short',
            })}
          </p>
          <p className="mt-0.5 text-ink-dim">refresh · 5s</p>
        </div>
      </header>

      {/* ─── KPI grid (asymmetric) ─── */}
      <section className="grid grid-cols-12 gap-px bg-line border border-line">
        <KpiCard
          className="col-span-12 lg:col-span-5 p-8"
          eyebrow="01 · sms enviados"
          value={sent}
          accent
        />
        <KpiCard
          className="col-span-6 lg:col-span-3 p-6"
          eyebrow="02 · fallidos"
          value={failed}
          tone={failed > 0 ? 'err' : undefined}
        />
        <KpiCard
          className="col-span-6 lg:col-span-2 p-6"
          eyebrow="03 · devices"
          value={`${activeDevices}/${totalDevices}`}
          small
        />
        <KpiCard
          className="col-span-12 lg:col-span-2 p-6"
          eyebrow="04 · tasa fallo"
          value={`${failureRate.toFixed(1)}%`}
          small
          tone={failureRate > 5 ? 'warn' : undefined}
        />
      </section>

      {/* ─── Campaigns ─── */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="section-eyebrow mb-1">— traffic · live</p>
            <h2 className="font-display text-3xl">Campañas recientes</h2>
          </div>
          <Link
            to="/campaigns"
            className="text-2xs uppercase tracking-widest font-mono text-ink-secondary hover:text-accent"
          >
            ver todas →
          </Link>
        </div>

        {running.data && running.data.items.length > 0 ? (
          <div className="space-y-2">
            {running.data.items.map((c) => (
              <Link
                key={c.id}
                to={`/campaigns/${c.id}`}
                className="surface block px-5 py-4 hover:bg-canvas-overlay transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-display text-xl text-ink-primary group-hover:text-accent transition-colors">
                        {c.name}
                      </span>
                      <Badge>{c.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted truncate font-mono">
                      &gt; {c.messageTemplate}
                    </p>
                  </div>
                  <div className="text-right shrink-0 font-mono text-2xs uppercase tracking-widest">
                    <span className="text-ink-primary tabular">{c.sentCount}</span>
                    <span className="text-ink-dim mx-1">/</span>
                    <span className="text-ink-secondary tabular">{c.totalRecipients}</span>
                  </div>
                </div>
                {c.totalRecipients > 0 && (
                  <div className="mt-3">
                    <ProgressBar
                      value={c.sentCount + c.failedCount}
                      max={c.totalRecipients}
                      segments={48}
                    />
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted font-mono">— sin actividad reciente —</p>
        )}
      </section>

      {/* ─── Devices fleet ─── */}
      <section>
        <div className="divider-label mb-4">device fleet</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {devices.data?.items.map((d) => (
            <div key={d.id} className="surface px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink-primary">{d.name}</p>
                <Badge>{d.status}</Badge>
              </div>
              <p className="mt-1 text-2xs font-mono text-ink-muted">
                circuit · <span className="text-ink-secondary">{d.circuitState}</span> · prio{' '}
                <span className="text-ink-secondary">{d.priority}</span>
              </p>
            </div>
          ))}
          {devices.data?.items.length === 0 && (
            <p className="text-sm text-ink-muted font-mono col-span-full">— sin devices —</p>
          )}
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  className,
  eyebrow,
  value,
  small,
  accent,
  tone,
}: {
  className: string;
  eyebrow: string;
  value: number | string;
  small?: boolean;
  accent?: boolean;
  tone?: 'err' | 'warn';
}) {
  const valueColor = accent
    ? 'text-accent'
    : tone === 'err'
      ? 'text-signal-err'
      : tone === 'warn'
        ? 'text-signal-warn'
        : 'text-ink-primary';
  return (
    <div className={`bg-canvas-elevated relative overflow-hidden ${className}`}>
      <p className="section-eyebrow">{eyebrow}</p>
      <p
        className={`font-display ${small ? 'text-5xl' : 'text-7xl'} leading-none mt-4 tabular ${valueColor}`}
      >
        {value}
      </p>
    </div>
  );
}
