import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listsApi } from '@/api/lists';
import { contactsApi } from '@/api/contacts';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';

export function ListDetailPage() {
  const qc = useQueryClient();
  const { id = '' } = useParams();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const list = useQuery({
    queryKey: ['list', id],
    queryFn: () => listsApi.getById(id),
    enabled: !!id,
  });
  const members = useQuery({
    queryKey: ['list', id, 'members'],
    queryFn: () => listsApi.members(id, { pageSize: 200 }),
    enabled: !!id,
  });

  const candidates = useQuery({
    queryKey: ['contacts', 'add-to-list', search],
    queryFn: () => contactsApi.list({ search: search || undefined, pageSize: 100 }),
    enabled: showAdd,
  });

  const add = useMutation({
    mutationFn: (ids: string[]) => listsApi.addMembers(id, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['list', id] });
      qc.invalidateQueries({ queryKey: ['lists'] });
      setShowAdd(false);
      setSelected(new Set());
    },
  });

  const removeMember = useMutation({
    mutationFn: (contactId: string) => listsApi.removeMember(id, contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['list', id] });
      qc.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  const memberIds = new Set(members.data?.items.map((m) => m.id) ?? []);

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/lists"
          className="text-2xs uppercase tracking-widest font-mono text-ink-muted hover:text-accent"
        >
          ← listas
        </Link>
        <header className="mt-2 flex items-end justify-between border-b border-line pb-6">
          <div>
            <p className="section-eyebrow mb-2">
              — segment · {members.data?.total ?? 0} contactos
            </p>
            <h1 className="font-display text-5xl leading-none">{list.data?.name ?? '...'}</h1>
            {list.data?.description && (
              <p className="mt-2 text-sm text-ink-secondary max-w-xl">{list.data.description}</p>
            )}
          </div>
          <Button onClick={() => setShowAdd(true)}>+ Agregar contactos</Button>
        </header>
      </div>

      <div className="surface overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>phone</th>
              <th>name</th>
              <th className="text-right">action</th>
            </tr>
          </thead>
          <tbody>
            {members.data?.items.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-12 text-2xs uppercase tracking-widest font-mono text-ink-muted">
                  — lista vacía. agregá contactos. —
                </td>
              </tr>
            )}
            {members.data?.items.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-ink-primary">{c.phoneE164}</td>
                <td>{c.name ?? <span className="text-ink-dim">—</span>}</td>
                <td className="text-right">
                  <Button variant="danger" onClick={() => removeMember.mutate(c.id)}>
                    quitar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={showAdd}
        onClose={() => {
          setShowAdd(false);
          setSelected(new Set());
        }}
        eyebrow="/ add to segment"
        title="Agregar contactos"
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowAdd(false);
                setSelected(new Set());
              }}
            >
              cancel
            </Button>
            <Button
              loading={add.isPending}
              disabled={selected.size === 0}
              onClick={() => add.mutate([...selected])}
            >
              add{selected.size > 0 ? ` (${selected.size})` : ''}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            placeholder="buscar contactos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="surface-overlay max-h-80 overflow-y-auto divide-y divide-line">
            {candidates.data?.items.map((c) => {
              const already = memberIds.has(c.id);
              const checked = selected.has(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    already ? 'opacity-40' : 'cursor-pointer hover:bg-canvas-overlay'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={already}
                    checked={already || checked}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(c.id);
                      else next.delete(c.id);
                      setSelected(next);
                    }}
                    className="accent-accent"
                  />
                  <span className="font-mono text-ink-primary">{c.phoneE164}</span>
                  <span className="text-ink-secondary">{c.name ?? '—'}</span>
                  {already && (
                    <span className="ml-auto text-2xs uppercase tracking-widest font-mono text-ink-dim">
                      ya en lista
                    </span>
                  )}
                </label>
              );
            })}
            {candidates.data?.items.length === 0 && (
              <p className="px-4 py-6 text-center text-2xs uppercase tracking-widest font-mono text-ink-muted">
                — sin resultados —
              </p>
            )}
          </div>
          {add.isError && (
            <p className="text-2xs font-mono text-signal-err">{(add.error as Error).message}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
