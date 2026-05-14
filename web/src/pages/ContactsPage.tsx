import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '@/api/contacts';
import { listsApi } from '@/api/lists';
import { Button } from '@/components/Button';
import { Input, Textarea } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { CsvDropzone } from '@/components/CsvDropzone';
import { EmptyState } from '@/components/EmptyState';
import type { ImportSummary } from '@/api/types';

interface ImportProgress {
  phase: 'parsing' | 'validated' | 'progress';
  processed: number;
  total: number;
  imported: number;
  updated: number;
  skipped: number;
}

const PAGE_SIZE = 100;

export function ContactsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkDefaultName, setBulkDefaultName] = useState('');
  const [bulkResult, setBulkResult] = useState<ImportSummary | null>(null);
  const [form, setForm] = useState({ phone: '', name: '', email: '' });
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const importAbortRef = useRef<AbortController | null>(null);

  // Selección múltiple: el Set se acumula entre páginas, así que el usuario
  // puede tildar contactos en pág 1, pasar a pág 2 y seguir tildando antes
  // de mandar todos a una lista.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddToList, setShowAddToList] = useState(false);
  const [targetListId, setTargetListId] = useState<string>('');
  const [addToListResult, setAddToListResult] = useState<{ added: number; listName: string } | null>(
    null,
  );

  const list = useQuery({
    queryKey: ['contacts', search, page],
    queryFn: () => contactsApi.list({ search: search || undefined, page, pageSize: PAGE_SIZE }),
  });

  const lists = useQuery({
    queryKey: ['lists'],
    queryFn: () => listsApi.list(),
    enabled: showAddToList,
  });

  const addToList = useMutation({
    mutationFn: (input: { listId: string; contactIds: string[] }) =>
      listsApi.addMembers(input.listId, input.contactIds),
    onSuccess: (res, vars) => {
      const listName = lists.data?.items.find((l) => l.id === vars.listId)?.name ?? '';
      setAddToListResult({ added: res.added, listName });
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ['list', vars.listId] });
      qc.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  const visibleIds = useMemo(() => list.data?.items.map((c) => c.id) ?? [], [list.data]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  const toggleAllVisible = (): void => {
    const next = new Set(selectedIds);
    if (allVisibleSelected) {
      for (const id of visibleIds) next.delete(id);
    } else {
      for (const id of visibleIds) next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleOne = (id: string, checked: boolean): void => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const closeAddToListModal = (): void => {
    setShowAddToList(false);
    setTargetListId('');
    setAddToListResult(null);
    addToList.reset();
  };

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
    onError: (err: Error) => {
      // El backend devuelve 409 con mensaje claro si el contacto tiene
      // mensajes en campañas. Lo mostramos al usuario en vez de fallar mudo.
      alert(`No se pudo borrar: ${err.message}`);
    },
  });

  const bulkCreate = useMutation({
    mutationFn: (input: { phones: string[]; defaultName?: string }) =>
      contactsApi.bulkCreate(input),
    onSuccess: (summary) => {
      setBulkResult(summary);
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const closeBulkModal = (): void => {
    setShowBulk(false);
    setBulkText('');
    setBulkDefaultName('');
    setBulkResult(null);
    bulkCreate.reset();
  };

  const parseBulkPhones = (text: string): string[] => {
    return text
      .split(/[\n,;\t]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  const bulkPhones = parseBulkPhones(bulkText);

  const startImport = async (csv: string): Promise<void> => {
    setImportError(null);
    setImportResult(null);
    setImportProgress({
      phase: 'parsing',
      processed: 0,
      total: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
    });
    setImporting(true);
    const abort = new AbortController();
    importAbortRef.current = abort;
    try {
      const summary = await contactsApi.importCsvStream(
        csv,
        (event) => {
          if (event.phase === 'validated') {
            setImportProgress((prev) => ({
              ...(prev ?? { imported: 0, updated: 0, processed: 0 }),
              phase: 'validated',
              total: event.valid,
              skipped: event.invalid,
            }));
          } else if (event.phase === 'progress') {
            setImportProgress({
              phase: 'progress',
              processed: event.processed,
              total: event.total,
              imported: event.imported,
              updated: event.updated,
              skipped: event.skipped,
            });
          }
        },
        abort.signal,
      );
      setImportResult(summary);
      qc.invalidateQueries({ queryKey: ['contacts'] });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setImportError((err as Error).message);
      }
    } finally {
      setImporting(false);
      importAbortRef.current = null;
    }
  };

  const closeImportModal = (): void => {
    importAbortRef.current?.abort();
    setShowImport(false);
    setImportResult(null);
    setImportProgress(null);
    setImportError(null);
  };

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
          {selectedIds.size > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddToList(true);
                setAddToListResult(null);
              }}
            >
              → Agregar a lista ({selectedIds.size})
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setShowImport(true);
              setImportResult(null);
            }}
          >
            ↑ Import CSV
          </Button>
          <Button variant="secondary" onClick={() => setShowBulk(true)}>
            ✎ Pegar varios
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
          {selectedIds.size > 0 && (
            <div className="surface-overlay px-4 py-2 flex items-center justify-between text-2xs uppercase tracking-widest font-mono">
              <span className="text-ink-primary">
                <span className="text-accent tabular">{selectedIds.size}</span> seleccionado
                {selectedIds.size === 1 ? '' : 's'} en total
                <span className="text-ink-muted ml-2">(persiste al cambiar de página)</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-ink-muted hover:text-signal-err"
              >
                limpiar
              </button>
            </div>
          )}
          <div className="surface overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                      }}
                      onChange={toggleAllVisible}
                      className="accent-accent"
                      aria-label="seleccionar todos los visibles"
                    />
                  </th>
                  <th>phone</th>
                  <th>name</th>
                  <th>email</th>
                  <th className="text-right">actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.items.map((c) => {
                  const checked = selectedIds.has(c.id);
                  return (
                    <tr key={c.id} className={checked ? 'bg-canvas-overlay' : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleOne(c.id, e.target.checked)}
                          className="accent-accent"
                          aria-label={`seleccionar ${c.phoneE164}`}
                        />
                      </td>
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
                  );
                })}
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
        onClose={closeImportModal}
        eyebrow="/ bulk upload"
        title="Importar CSV"
        size="lg"
      >
        {importResult ? null : importing || importProgress ? (
          <ImportProgressView progress={importProgress} />
        ) : (
          <CsvDropzone disabled={importing} onFile={(csv) => void startImport(csv)} />
        )}
        {importResult && (
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
              <Button onClick={closeImportModal}>done</Button>
            </div>
          </div>
        )}
        {importError && (
          <p className="mt-3 text-2xs font-mono text-signal-err">{importError}</p>
        )}
      </Modal>

      <Modal
        open={showBulk}
        onClose={closeBulkModal}
        eyebrow="/ paste bulk"
        title="Pegar varios contactos"
        size="lg"
        footer={
          bulkResult ? (
            <Button onClick={closeBulkModal}>done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeBulkModal}>
                cancel
              </Button>
              <Button
                loading={bulkCreate.isPending}
                disabled={bulkPhones.length === 0}
                onClick={() =>
                  bulkCreate.mutate({
                    phones: bulkPhones,
                    defaultName: bulkDefaultName.trim() || undefined,
                  })
                }
              >
                cargar{bulkPhones.length > 0 ? ` (${bulkPhones.length})` : ''}
              </Button>
            </>
          )
        }
      >
        {bulkResult ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-px bg-line border border-line">
              <div className="bg-canvas-elevated p-4">
                <p className="section-eyebrow">created</p>
                <p className="font-display text-4xl text-signal-ok mt-1 tabular">
                  {bulkResult.imported}
                </p>
              </div>
              <div className="bg-canvas-elevated p-4">
                <p className="section-eyebrow">updated</p>
                <p className="font-display text-4xl text-accent mt-1 tabular">
                  {bulkResult.updated}
                </p>
              </div>
              <div className="bg-canvas-elevated p-4">
                <p className="section-eyebrow">skipped</p>
                <p className="font-display text-4xl text-signal-err mt-1 tabular">
                  {bulkResult.skipped}
                </p>
              </div>
            </div>
            {bulkResult.errors.length > 0 && (
              <div>
                <p className="section-eyebrow mb-2">errores</p>
                <div className="surface-overlay max-h-48 overflow-y-auto divide-y divide-line">
                  {bulkResult.errors.map((e) => (
                    <div
                      key={`${e.row}-${e.phone}`}
                      className="px-3 py-2 text-2xs font-mono text-signal-err flex justify-between"
                    >
                      <span>línea {e.row} · {e.phone || '(vacía)'}</span>
                      <span className="text-ink-muted">{e.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-2xs font-mono text-ink-muted">
              pegá los teléfonos: uno por línea, o separados por coma / punto y coma. los que estén
              duplicados se ignoran. los inválidos quedan listados en el resumen.
            </p>
            <Textarea
              label={`Teléfonos${bulkPhones.length > 0 ? ` (${bulkPhones.length} detectados)` : ''}`}
              rows={10}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'+5491100000001\n+5491100000002\n11 4567 8901'}
              className="font-mono text-sm"
            />
            <Input
              label="Nombre por defecto (opcional)"
              value={bulkDefaultName}
              onChange={(e) => setBulkDefaultName(e.target.value)}
              placeholder="se aplica a los nuevos si no tenían"
            />
            {bulkCreate.isError && (
              <p className="text-2xs font-mono text-signal-err">
                {(bulkCreate.error as Error).message}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={showAddToList}
        onClose={closeAddToListModal}
        eyebrow="/ assign to segment"
        title="Agregar contactos a una lista"
        footer={
          addToListResult ? (
            <Button onClick={closeAddToListModal}>done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeAddToListModal}>
                cancel
              </Button>
              <Button
                loading={addToList.isPending}
                disabled={!targetListId || selectedIds.size === 0}
                onClick={() =>
                  addToList.mutate({ listId: targetListId, contactIds: [...selectedIds] })
                }
              >
                agregar ({selectedIds.size})
              </Button>
            </>
          )
        }
      >
        {addToListResult ? (
          <div className="space-y-3">
            <p className="text-ink-primary text-sm">
              se agregaron{' '}
              <span className="font-mono text-accent tabular">{addToListResult.added}</span>{' '}
              contactos a{' '}
              <span className="font-mono text-ink-primary">{addToListResult.listName}</span>.
            </p>
            {addToListResult.added < selectedIds.size && (
              <p className="text-2xs font-mono text-ink-muted">
                el resto ya estaba en la lista (los duplicados se ignoran).
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-2xs font-mono text-ink-muted">
              vas a sumar {selectedIds.size} contacto{selectedIds.size === 1 ? '' : 's'} a la
              lista que elijas. los que ya estén en la lista se ignoran.
            </p>
            <div className="space-y-1.5">
              <label className="block text-2xs uppercase tracking-widest font-mono text-ink-muted">
                lista destino
              </label>
              <select
                value={targetListId}
                onChange={(e) => setTargetListId(e.target.value)}
                className="w-full bg-canvas-elevated border border-line px-3 py-2 text-sm text-ink-primary font-mono"
              >
                <option value="">— elegí una lista —</option>
                {lists.data?.items.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.memberCount})
                  </option>
                ))}
              </select>
              {lists.isLoading && (
                <p className="text-2xs font-mono text-ink-muted">cargando listas...</p>
              )}
              {lists.data && lists.data.items.length === 0 && (
                <p className="text-2xs font-mono text-signal-warn">
                  no hay listas creadas todavía. creá una desde la sección Listas.
                </p>
              )}
            </div>
            {addToList.isError && (
              <p className="text-2xs font-mono text-signal-err">
                {(addToList.error as Error).message}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ImportProgressView({ progress }: { progress: ImportProgress | null }): JSX.Element {
  const total = progress?.total ?? 0;
  const processed = progress?.processed ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const indeterminate = !progress || progress.phase === 'parsing' || total === 0;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex justify-between text-2xs font-mono uppercase tracking-widest text-ink-secondary mb-2">
          <span>
            {progress?.phase === 'parsing'
              ? 'parsing csv...'
              : indeterminate
                ? 'validating rows...'
                : `${processed.toLocaleString('es-AR')} / ${total.toLocaleString('es-AR')}`}
          </span>
          <span className="tabular text-ink-primary">{indeterminate ? '' : `${pct}%`}</span>
        </div>
        <div className="h-2 bg-canvas-elevated border border-line overflow-hidden">
          <div
            className={`h-full bg-accent transition-all ${indeterminate ? 'animate-pulse w-1/3' : ''}`}
            style={indeterminate ? undefined : { width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-line border border-line">
        <div className="bg-canvas-elevated p-3">
          <p className="section-eyebrow">imported</p>
          <p className="font-display text-3xl text-signal-ok mt-1 tabular">
            {(progress?.imported ?? 0).toLocaleString('es-AR')}
          </p>
        </div>
        <div className="bg-canvas-elevated p-3">
          <p className="section-eyebrow">updated</p>
          <p className="font-display text-3xl text-accent mt-1 tabular">
            {(progress?.updated ?? 0).toLocaleString('es-AR')}
          </p>
        </div>
        <div className="bg-canvas-elevated p-3">
          <p className="section-eyebrow">skipped</p>
          <p className="font-display text-3xl text-signal-err mt-1 tabular">
            {(progress?.skipped ?? 0).toLocaleString('es-AR')}
          </p>
        </div>
      </div>

      <p className="text-2xs font-mono text-ink-muted">
        ⚠ no cierres esta ventana hasta que termine. cerrar aborta el import.
      </p>
    </div>
  );
}
