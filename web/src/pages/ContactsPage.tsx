import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '@/api/contacts';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { CsvDropzone } from '@/components/CsvDropzone';
import { EmptyState } from '@/components/EmptyState';
import type { ImportSummary } from '@/api/types';

export function ContactsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ phone: '', name: '', email: '' });
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);

  const list = useQuery({
    queryKey: ['contacts', search, page],
    queryFn: () => contactsApi.list({ search: search || undefined, page, pageSize: 20 }),
  });

  const create = useMutation({
    mutationFn: contactsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      setShowCreate(false);
      setForm({ phone: '', name: '', email: '' });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => contactsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const importCsv = useMutation({
    mutationFn: contactsApi.importCsv,
    onSuccess: (summary) => {
      setImportResult(summary);
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between border-b border-line pb-6">
        <div>
          <p className="section-eyebrow mb-2">— directory · {list.data?.total ?? 0} entries</p>
          <h1 className="font-display text-6xl leading-none">
            Contactos<span className="text-accent">.</span>
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setShowImport(true);
              setImportResult(null);
            }}
          >
            ↑ Import CSV
          </Button>
          <Button onClick={() => setShowCreate(true)}>+ Nuevo</Button>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <span className="text-2xs uppercase tracking-widest font-mono text-ink-muted">search</span>
        <Input
          placeholder="nombre, teléfono o email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 max-w-md"
        />
      </div>

      {list.data && list.data.items.length === 0 ? (
        <EmptyState title="Sin contactos" hint="Cargá uno o importá un CSV." />
      ) : (
        <>
          <div className="surface overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>phone</th>
                  <th>name</th>
                  <th>email</th>
                  <th className="text-right">actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.items.map((c) => (
                  <tr key={c.id}>
                    <td className="font-mono text-ink-primary">{c.phoneE164}</td>
                    <td>{c.name ?? <span className="text-ink-dim">—</span>}</td>
                    <td className="text-ink-secondary text-xs">
                      {c.email ?? <span className="text-ink-dim">—</span>}
                    </td>
                    <td className="text-right">
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (confirm(`Borrar ${c.phoneE164}?`)) remove.mutate(c.id);
                        }}
                      >
                        delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-2xs uppercase tracking-widest font-mono">
              <Button
                variant="secondary"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                ← prev
              </Button>
              <span className="text-ink-secondary">
                page <span className="text-ink-primary tabular">{page}</span> /{' '}
                <span className="text-ink-secondary tabular">{totalPages}</span>
              </span>
              <Button
                variant="secondary"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                next →
              </Button>
            </div>
          )}
        </>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        eyebrow="/ new entry"
        title="Nuevo contacto"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={!form.phone}
              onClick={() =>
                create.mutate({
                  phone: form.phone,
                  name: form.name || undefined,
                  email: form.email || undefined,
                })
              }
            >
              save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Teléfono"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="input-mono"
            placeholder="+5491100000000"
          />
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          {create.isError && (
            <p className="text-2xs font-mono text-signal-err">{(create.error as Error).message}</p>
          )}
        </div>
      </Modal>

      <Modal
        open={showImport}
        onClose={() => setShowImport(false)}
        eyebrow="/ bulk upload"
        title="Importar CSV"
        size="lg"
      >
        {!importResult ? (
          <CsvDropzone disabled={importCsv.isPending} onFile={(csv) => importCsv.mutate(csv)} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-px bg-line border border-line">
              <div className="bg-canvas-elevated p-4">
                <p className="section-eyebrow">imported</p>
                <p className="font-display text-4xl text-signal-ok mt-1 tabular">
                  {importResult.imported}
                </p>
              </div>
              <div className="bg-canvas-elevated p-4">
                <p className="section-eyebrow">updated</p>
                <p className="font-display text-4xl text-accent mt-1 tabular">
                  {importResult.updated}
                </p>
              </div>
              <div className="bg-canvas-elevated p-4">
                <p className="section-eyebrow">skipped</p>
                <p className="font-display text-4xl text-signal-err mt-1 tabular">
                  {importResult.skipped}
                </p>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div>
                <p className="section-eyebrow mb-2">errores</p>
                <div className="surface-overlay max-h-48 overflow-y-auto divide-y divide-line">
                  {importResult.errors.map((e) => (
                    <div
                      key={`${e.row}-${e.phone}`}
                      className="px-3 py-2 text-2xs font-mono text-signal-err flex justify-between"
                    >
                      <span>row {e.row} · {e.phone || '(empty)'}</span>
                      <span className="text-ink-muted">{e.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => {
                  setShowImport(false);
                  setImportResult(null);
                }}
              >
                done
              </Button>
            </div>
          </div>
        )}
        {importCsv.isError && (
          <p className="mt-3 text-2xs font-mono text-signal-err">
            {(importCsv.error as Error).message}
          </p>
        )}
      </Modal>
    </div>
  );
}
