import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listsApi } from '@/api/lists';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';

export function ListsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const list = useQuery({ queryKey: ['lists'], queryFn: listsApi.list });

  const create = useMutation({
    mutationFn: listsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lists'] });
      setShowCreate(false);
      setForm({ name: '', description: '' });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => listsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  });

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between border-b border-line pb-6">
        <div>
          <p className="section-eyebrow mb-2">— audience segments</p>
          <h1 className="font-display text-6xl leading-none">
            Listas<span className="text-accent">.</span>
          </h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nueva</Button>
      </header>

      {list.data && list.data.items.length === 0 ? (
        <EmptyState title="Sin listas" hint="Agrupá contactos para mandarles campañas." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
          {list.data?.items.map((l, idx) => (
            <Link
              key={l.id}
              to={`/lists/${l.id}`}
              className="surface block p-5 hover:bg-canvas-overlay group transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xs font-mono tracking-widest text-ink-dim">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="text-2xs uppercase tracking-widest font-mono text-accent">
                  {l.memberCount} ◆
                </span>
              </div>
              <h3 className="font-display text-2xl text-ink-primary group-hover:text-accent transition-colors">
                {l.name}
              </h3>
              {l.description && (
                <p className="mt-1 text-sm text-ink-secondary line-clamp-2">{l.description}</p>
              )}
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-line">
                <span className="text-2xs uppercase tracking-widest font-mono text-ink-muted">
                  {l.memberCount === 1 ? 'contact' : 'contacts'}
                </span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirm(`Borrar "${l.name}"?`)) remove.mutate(l.id);
                  }}
                  className="text-2xs uppercase tracking-widest font-mono text-ink-muted hover:text-signal-err"
                >
                  delete
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        eyebrow="/ new segment"
        title="Nueva lista"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={!form.name}
              onClick={() =>
                create.mutate({ name: form.name, description: form.description || undefined })
              }
            >
              create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Clientes premium"
          />
          <Input
            label="Descripción"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="opcional"
          />
          {create.isError && (
            <p className="text-2xs font-mono text-signal-err">{(create.error as Error).message}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
