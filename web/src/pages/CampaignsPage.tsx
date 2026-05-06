import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignsApi } from '@/api/campaigns';
import { listsApi } from '@/api/lists';
import { Button } from '@/components/Button';
import { Input, Textarea } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { ProgressBar } from '@/components/ProgressBar';
import { EmptyState } from '@/components/EmptyState';

export function CampaignsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', messageTemplate: '', listId: '', tpsLimit: 1 });

  const list = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsApi.list({ pageSize: 100 }),
    refetchInterval: 3_000,
  });
  const lists = useQuery({ queryKey: ['lists'], queryFn: listsApi.list, enabled: showCreate });

  const create = useMutation({
    mutationFn: campaignsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      setShowCreate(false);
      setForm({ name: '', messageTemplate: '', listId: '', tpsLimit: 1 });
    },
  });

  const launch = useMutation({
    mutationFn: (id: string) => campaignsApi.launch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between border-b border-line pb-6">
        <div>
          <p className="section-eyebrow mb-2">— broadcast queue · {list.data?.total ?? 0}</p>
          <h1 className="font-display text-6xl leading-none">
            Campañas<span className="text-accent">.</span>
          </h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nueva</Button>
      </header>

      {list.data && list.data.items.length === 0 ? (
        <EmptyState
          title="Sin campañas"
          hint="Redactá un mensaje, elegí una lista y lanzá."
          action={<Button onClick={() => setShowCreate(true)}>Crear</Button>}
        />
      ) : (
        <div className="space-y-2 stagger">
          {list.data?.items.map((c, idx) => (
            <div key={c.id} className="surface p-5 hover:bg-canvas-overlay transition-colors group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xs font-mono tracking-widest text-ink-dim">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <Link
                      to={`/campaigns/${c.id}`}
                      className="font-display text-2xl text-ink-primary group-hover:text-accent transition-colors"
                    >
                      {c.name}
                    </Link>
                    <Badge>{c.status}</Badge>
                  </div>
                  <p className="text-xs text-ink-muted truncate font-mono pl-9">
                    &gt; {c.messageTemplate}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.status === 'DRAFT' && (
                    <Button onClick={() => launch.mutate(c.id)} loading={launch.isPending}>
                      ▶ Lanzar
                    </Button>
                  )}
                  <Link
                    to={`/campaigns/${c.id}`}
                    className="btn-secondary"
                  >
                    open →
                  </Link>
                </div>
              </div>
              {c.totalRecipients > 0 && (
                <div className="mt-4 pl-9">
                  <ProgressBar
                    value={c.sentCount + c.failedCount}
                    max={c.totalRecipients}
                    segments={64}
                    label={`sent ${c.sentCount} · failed ${c.failedCount}`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        eyebrow="/ new broadcast"
        title="Nueva campaña"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={!form.name || !form.messageTemplate || !form.listId}
              onClick={() =>
                create.mutate({
                  name: form.name,
                  messageTemplate: form.messageTemplate,
                  listId: form.listId,
                  tpsLimit: form.tpsLimit,
                })
              }
            >
              create draft
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Promo Black Friday"
          />
          <div>
            <label className="label">Lista de destinatarios</label>
            <select
              className="input"
              value={form.listId}
              onChange={(e) => setForm({ ...form, listId: e.target.value })}
            >
              <option value="">— elegí una lista —</option>
              {lists.data?.items.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.memberCount} contacts
                </option>
              ))}
            </select>
          </div>
          <Textarea
            label="Mensaje · libre"
            rows={5}
            maxLength={1600}
            value={form.messageTemplate}
            onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })}
            placeholder="Hola {{name}}, llegó tu pedido."
            hint={`variables: {{name}}, {{phone}} · ${form.messageTemplate.length}/1600 chars`}
            className="font-mono"
          />
          <Input
            label="TPS · SMS por segundo"
            type="number"
            min={1}
            max={50}
            value={form.tpsLimit}
            onChange={(e) => setForm({ ...form, tpsLimit: Number(e.target.value) })}
            hint="default 1/s · evita quemar la SIM y parecer spam"
          />
          {create.isError && (
            <p className="text-2xs font-mono text-signal-err">{(create.error as Error).message}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
