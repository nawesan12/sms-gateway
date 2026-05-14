import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignsApi } from '@/api/campaigns';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { ProgressBar } from '@/components/ProgressBar';
import { Textarea } from '@/components/Input';

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
    onError: (err: Error) => alert(`No se pudo lanzar: ${err.message}`),
  });

  const cancel = useMutation({
    mutationFn: () => campaignsApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', id] }),
    onError: (err: Error) => alert(`No se pudo cancelar: ${err.message}`),
  });

  const [editingMessage, setEditingMessage] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [draftMph, setDraftMph] = useState<number | ''>('');

  const updateMessage = useMutation({
    mutationFn: (messageTemplate: string) => campaignsApi.update(id, { messageTemplate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', id] });
      setEditingMessage(false);
    },
  });

  const updateMph = useMutation({
    mutationFn: (messagesPerHour: number) => campaignsApi.update(id, { messagesPerHour }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', id] }),
    onError: (err: Error) => alert(`No se pudo actualizar el ritmo: ${err.message}`),
  });

  const c = detail.data;

  // Cuando se entra a modo edición, precargo el draft con el template actual.
  useEffect(() => {
    if (editingMessage && c) setDraftMessage(c.messageTemplate);
  }, [editingMessage, c]);

  // Sincronizo el input de mph con el valor remoto cuando carga / cambia.
  useEffect(() => {
    if (c) setDraftMph(c.messagesPerHour);
  }, [c]);

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
              <p className="section-eyebrow mb-2">
                — broadcast · ritmo{' '}
                <input
                  type="number"
                  min={1}
                  value={draftMph}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setDraftMph(Number.isNaN(n) ? '' : n);
                  }}
                  onBlur={() => {
                    if (
                      typeof draftMph === 'number' &&
                      draftMph >= 1 &&
                      draftMph !== c.messagesPerHour
                    ) {
                      updateMph.mutate(draftMph);
                    }
                  }}
                  className="inline-block w-16 px-1 py-0 bg-canvas-overlay border border-line text-ink-primary font-mono text-2xs tabular text-center"
                />{' '}
                msg/hora
              </p>
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

      {c && <CampaignStatusBanner campaign={c} />}

      {c && (
        <>
          {/* Message preview / edit */}
          <div className="surface p-6 relative">
            <div className="flex items-start justify-between mb-3">
              <p className="section-eyebrow">/ message template</p>
              {!editingMessage ? (
                <button
                  type="button"
                  onClick={() => setEditingMessage(true)}
                  className="text-2xs uppercase tracking-widest font-mono text-ink-muted hover:text-accent"
                >
                  ✎ editar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMessage(false);
                      updateMessage.reset();
                    }}
                    className="text-2xs uppercase tracking-widest font-mono text-ink-muted hover:text-signal-err"
                  >
                    cancelar
                  </button>
                  <button
                    type="button"
                    disabled={
                      updateMessage.isPending ||
                      draftMessage.trim().length === 0 ||
                      draftMessage === c.messageTemplate
                    }
                    onClick={() => updateMessage.mutate(draftMessage)}
                    className="text-2xs uppercase tracking-widest font-mono text-accent hover:text-ink-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {updateMessage.isPending ? 'guardando...' : '✓ guardar'}
                  </button>
                </div>
              )}
            </div>
            {!editingMessage ? (
              <pre className="font-mono text-sm text-ink-primary whitespace-pre-wrap leading-relaxed">
                {c.messageTemplate}
              </pre>
            ) : (
              <>
                <Textarea
                  rows={6}
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  className="font-mono text-sm"
                  hint={`variables permitidas: {{name}}, {{phone}} · ${draftMessage.length}/1600`}
                />
                {c.status !== 'DRAFT' && (
                  <p className="mt-2 text-2xs font-mono text-signal-warn">
                    ⚠ esta campaña ya está en estado {c.status}. los mensajes ya enviados no
                    cambian; los pendientes salen con el nuevo texto.
                  </p>
                )}
                {updateMessage.isError && (
                  <p className="mt-2 text-2xs font-mono text-signal-err">
                    {(updateMessage.error as Error).message}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-12 gap-px bg-line border border-line">
            <Stat
              className="col-span-12 lg:col-span-4 p-8"
              eyebrow="01 · progreso"
              value={`${(((c.sentCount + c.failedCount) / Math.max(1, c.totalRecipients)) * 100).toFixed(1)}%`}
              accent
              big
            />
            <Stat
              className="col-span-6 lg:col-span-2 p-6"
              eyebrow="02 · sent"
              value={c.deliveriesByStatus.SENT ?? c.sentCount}
              tone="ok"
            />
            <Stat
              className="col-span-6 lg:col-span-2 p-6"
              eyebrow="03 · delivered"
              value={c.deliveriesByStatus.DELIVERED ?? 0}
              tone="ok"
            />
            <Stat
              className="col-span-6 lg:col-span-2 p-6"
              eyebrow="04 · pending"
              value={c.deliveriesByStatus.PENDING ?? 0}
            />
            <Stat
              className="col-span-6 lg:col-span-2 p-6"
              eyebrow="05 · failed"
              value={c.deliveriesByStatus.FAILED ?? 0}
              tone={(c.deliveriesByStatus.FAILED ?? 0) > 0 ? 'err' : undefined}
            />
          </div>

          <div className="surface p-6">
            <ProgressBar
              value={c.sentCount + c.failedCount}
              max={c.totalRecipients}
              segments={80}
              label={`procesados ${c.sentCount + c.failedCount}/${c.totalRecipients}${
                (c.deliveriesByStatus.DELIVERED ?? 0) > 0
                  ? ` · entregados ${c.deliveriesByStatus.DELIVERED}`
                  : ''
              }`}
            />
          </div>
        </>
      )}

      <section>
        <div className="divider-label mb-4">delivery log</div>
        <div className="surface overflow-x-auto">
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
                    {d.deliveredAt
                      ? `✓ ${new Date(d.deliveredAt).toLocaleTimeString()}`
                      : d.sentAt
                        ? new Date(d.sentAt).toLocaleTimeString()
                        : ''}
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

import type { CampaignDetail } from '@/api/types';

function CampaignStatusBanner({ campaign }: { campaign: CampaignDetail }): JSX.Element | null {
  const { status, progress, totalRecipients, sentCount, failedCount } = campaign;
  const sent = sentCount;
  const failed = failedCount;
  const total = totalRecipients;

  if (status === 'COMPLETED') {
    return (
      <div className="surface p-4 border-l-4 border-signal-ok flex items-center gap-3">
        <span className="text-signal-ok font-display text-2xl">✓</span>
        <div>
          <p className="font-display text-lg text-ink-primary">campaña completa</p>
          <p className="text-2xs font-mono text-ink-secondary">
            {sent} enviados · {failed} fallidos · {total} total
          </p>
        </div>
      </div>
    );
  }

  if ((status === 'RUNNING' || status === 'QUEUED') && progress >= 0.5 && progress < 1) {
    return (
      <div className="surface p-4 border-l-4 border-accent flex items-center gap-3">
        <span className="text-accent font-display text-2xl">◐</span>
        <div>
          <p className="font-display text-lg text-ink-primary">mitad enviada</p>
          <p className="text-2xs font-mono text-ink-secondary">
            {sent + failed} de {total} procesados ({(progress * 100).toFixed(0)}%)
          </p>
        </div>
      </div>
    );
  }

  if (status === 'PAUSED') {
    return (
      <div className="surface p-4 border-l-4 border-signal-warn flex items-center gap-3">
        <span className="text-signal-warn font-display text-2xl">⏸</span>
        <div>
          <p className="font-display text-lg text-ink-primary">campaña pausada</p>
          <p className="text-2xs font-mono text-ink-secondary">
            el sistema detuvo el envío. revisá saldo de tokens, devices activos o
            configuración de Firebase y volvé a lanzar.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'FAILED') {
    return (
      <div className="surface p-4 border-l-4 border-signal-err flex items-center gap-3">
        <span className="text-signal-err font-display text-2xl">✗</span>
        <div>
          <p className="font-display text-lg text-ink-primary">campaña con error</p>
          <p className="text-2xs font-mono text-ink-secondary">
            revisá el log de envíos para ver qué falló.
          </p>
        </div>
      </div>
    );
  }

  return null;
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
