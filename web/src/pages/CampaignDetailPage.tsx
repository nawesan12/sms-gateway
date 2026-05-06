import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignsApi } from '@/api/campaigns';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { ProgressBar } from '@/components/ProgressBar';

export function CampaignDetailPage() {
  const qc = useQueryClient();
  const { id = '' } = useParams();

  const detail = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignsApi.getById(id),
    refetchInterval: 2_000,
    enabled: !!id,
  });
  const deliveries = useQuery({
    queryKey: ['campaign', id, 'deliveries'],
    queryFn: () => campaignsApi.deliveries(id, { pageSize: 200 }),
    refetchInterval: 3_000,
    enabled: !!id,
  });

  const launch = useMutation({
    mutationFn: () => campaignsApi.launch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', id] }),
  });

  const cancel = useMutation({
    mutationFn: () => campaignsApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', id] }),
  });

  const c = detail.data;

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/campaigns"
          className="text-2xs uppercase tracking-widest font-mono text-ink-muted hover:text-accent"
        >
          ← campañas
        </Link>
        {c && (
          <header className="mt-2 flex items-end justify-between border-b border-line pb-6 gap-6">
            <div>
              <p className="section-eyebrow mb-2">— broadcast · tps {c.tpsLimit}/s</p>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-display text-5xl leading-none">{c.name}</h1>
                <Badge>{c.status}</Badge>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {c.status === 'DRAFT' && (
                <Button onClick={() => launch.mutate()} loading={launch.isPending}>
                  ▶ Lanzar
                </Button>
              )}
              {(c.status === 'QUEUED' || c.status === 'RUNNING') && (
                <Button variant="danger" onClick={() => cancel.mutate()} loading={cancel.isPending}>
                  ■ Cancelar
                </Button>
              )}
            </div>
          </header>
        )}
      </div>

      {c && (
        <>
          {/* Message preview */}
          <div className="surface p-6 relative">
            <p className="section-eyebrow mb-3">/ message template</p>
            <pre className="font-mono text-sm text-ink-primary whitespace-pre-wrap leading-relaxed">
              {c.messageTemplate}
            </pre>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-12 gap-px bg-line border border-line">
            <Stat
              className="col-span-12 lg:col-span-6 p-8"
              eyebrow="01 · progreso"
              value={`${(((c.sentCount + c.failedCount) / Math.max(1, c.totalRecipients)) * 100).toFixed(1)}%`}
              accent
              big
            />
            <Stat className="col-span-6 lg:col-span-2 p-6" eyebrow="02 · sent" value={c.sentCount} tone="ok" />
            <Stat className="col-span-6 lg:col-span-2 p-6" eyebrow="03 · pending" value={c.deliveriesByStatus.PENDING ?? 0} />
            <Stat
              className="col-span-12 lg:col-span-2 p-6"
              eyebrow="04 · failed"
              value={c.deliveriesByStatus.FAILED ?? 0}
              tone={c.deliveriesByStatus.FAILED ?? 0 > 0 ? 'err' : undefined}
            />
          </div>

          <div className="surface p-6">
            <ProgressBar
              value={c.sentCount + c.failedCount}
              max={c.totalRecipients}
              segments={80}
              label={`procesados ${c.sentCount + c.failedCount}/${c.totalRecipients}`}
            />
          </div>
        </>
      )}

      <section>
        <div className="divider-label mb-4">delivery log</div>
        <div className="surface overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>phone</th>
                <th>name</th>
                <th>status</th>
                <th>error</th>
                <th>sent at</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.data?.items.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-xs">{d.contact.phoneE164}</td>
                  <td>{d.contact.name ?? <span className="text-ink-dim">—</span>}</td>
                  <td>
                    <Badge>{d.status}</Badge>
                  </td>
                  <td className="text-2xs font-mono text-signal-err">{d.errorMessage ?? ''}</td>
                  <td className="text-2xs font-mono text-ink-muted">
                    {d.sentAt ? new Date(d.sentAt).toLocaleTimeString() : ''}
                  </td>
                </tr>
              ))}
              {deliveries.data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-2xs uppercase tracking-widest font-mono text-ink-muted">
                    — sin envíos aún —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  className,
  eyebrow,
  value,
  big,
  accent,
  tone,
}: {
  className: string;
  eyebrow: string;
  value: number | string;
  big?: boolean;
  accent?: boolean;
  tone?: 'ok' | 'err' | 'warn';
}) {
  const color = accent
    ? 'text-accent'
    : tone === 'ok'
      ? 'text-signal-ok'
      : tone === 'err'
        ? 'text-signal-err'
        : tone === 'warn'
          ? 'text-signal-warn'
          : 'text-ink-primary';
  return (
    <div className={`bg-canvas-elevated ${className}`}>
      <p className="section-eyebrow">{eyebrow}</p>
      <p className={`font-display ${big ? 'text-7xl' : 'text-4xl'} mt-3 leading-none tabular ${color}`}>
        {value}
      </p>
    </div>
  );
}
