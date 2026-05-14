import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listsApi } from '@/api/lists';
import { contactsApi } from '@/api/contacts';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';

type AddMode = 'manual' | 'bulk';

const CANDIDATES_PAGE_SIZE = 100;
const MEMBERS_PAGE_SIZE = 200;

export function ListDetailPage() {
  const qc = useQueryClient();
  const { id = '' } = useParams();
  const [showAdd, setShowAdd] = useState(false);
  const [mode, setMode] = useState<AddMode>('manual');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLimit, setBulkLimit] = useState<number>(100);
  const [onlyWithoutList, setOnlyWithoutList] = useState<boolean>(false);
  const [bulkResult, setBulkResult] = useState<{
    added: number;
    matched: number;
    requested: number;
  } | null>(null);

  const list = useQuery({
    queryKey: ['list', id],
    queryFn: () => listsApi.getById(id),
    enabled: !!id,
  });

  // Members con scroll infinito: el modal admin puede tener listas de varios
  // miles, así que cargamos en lotes mediante useInfiniteQuery.
  const members = useInfiniteQuery({
    queryKey: ['list', id, 'members'],
    queryFn: ({ pageParam }) =>
      listsApi.members(id, { page: pageParam as number, pageSize: MEMBERS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const loaded = last.page * last.pageSize;
      return loaded < last.total ? last.page + 1 : undefined;
    },
    enabled: !!id,
  });

  const memberItems = useMemo(
    () => members.data?.pages.flatMap((p) => p.items) ?? [],
    [members.data],
  );
  const memberTotal = members.data?.pages[0]?.total ?? 0;

  const candidates = useInfiniteQuery({
    queryKey: ['contacts', 'add-to-list', search],
    queryFn: ({ pageParam }) =>
      contactsApi.list({
        search: search || undefined,
        page: pageParam as number,
        pageSize: CANDIDATES_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const loaded = last.page * last.pageSize;
      return loaded < last.total ? last.page + 1 : undefined;
    },
    enabled: showAdd && mode === 'manual',
  });

  const candidateItems = useMemo(
    () => candidates.data?.pages.flatMap((p) => p.items) ?? [],
    [candidates.data],
  );

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

  const validBulkLimit = Number.isFinite(bulkLimit) && bulkLimit >= 1;

  // Preview en vivo: cuántos contactos se agregarían realmente para los
  // valores actuales de search + limit. Debounced para no saturar el backend.
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [debouncedLimit, setDebouncedLimit] = useState(bulkLimit);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedLimit(bulkLimit), 300);
    return () => clearTimeout(t);
  }, [bulkLimit]);

  const preview = useQuery({
    queryKey: ['list', id, 'bulk-preview', debouncedSearch, debouncedLimit, onlyWithoutList],
    queryFn: () =>
      listsApi.bulkAddFromSearch(id, {
        search: debouncedSearch || undefined,
        limit: debouncedLimit,
        dryRun: true,
        onlyWithoutList,
      }),
    enabled: showAdd && mode === 'bulk' && validBulkLimit,
  });

  const bulkAdd = useMutation({
    mutationFn: () =>
      listsApi.bulkAddFromSearch(id, {
        search: search || undefined,
        limit: bulkLimit,
        onlyWithoutList,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['list', id] });
      qc.invalidateQueries({ queryKey: ['lists'] });
      setBulkResult({ added: res.added, matched: res.matched, requested: res.requested });
    },
  });

  const memberIds = useMemo(() => new Set(memberItems.map((m) => m.id)), [memberItems]);

  const closeModal = (): void => {
    setShowAdd(false);
    setSelected(new Set());
    setBulkResult(null);
  };

  // Sentinel para scroll infinito en el listado de candidatos.
  const candidatesSentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!showAdd || mode !== 'manual') return;
    const node = candidatesSentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && candidates.hasNextPage && !candidates.isFetchingNextPage) {
          void candidates.fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [showAdd, mode, candidates]);

  // Sentinel para scroll infinito en la tabla de members.
  const membersSentinelRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    const node = membersSentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && members.hasNextPage && !members.isFetchingNextPage) {
          void members.fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [members]);

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
              — segment · {memberTotal} contactos
            </p>
            <h1 className="font-display text-5xl leading-none">{list.data?.name ?? '...'}</h1>
            {list.data?.description && (
              <p className="mt-2 text-sm text-ink-secondary max-w-xl">{list.data.description}</p>
            )}
          </div>
          <Button onClick={() => setShowAdd(true)}>+ Agregar contactos</Button>
        </header>
      </div>

      <div className="surface overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>phone</th>
              <th>name</th>
              <th className="text-right">action</th>
            </tr>
          </thead>
          <tbody>
            {memberItems.length === 0 && !members.isLoading && (
              <tr>
                <td
                  colSpan={3}
                  className="text-center py-12 text-2xs uppercase tracking-widest font-mono text-ink-muted"
                >
                  — lista vacía. agregá contactos. —
                </td>
              </tr>
            )}
            {memberItems.map((c) => (
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
            {members.hasNextPage && (
              <tr ref={membersSentinelRef}>
                <td
                  colSpan={3}
                  className="text-center py-4 text-2xs uppercase tracking-widest font-mono text-ink-muted"
                >
                  {members.isFetchingNextPage ? '— cargando más... —' : '— scrollear para ver más —'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {removeMember.isError && (
        <p className="text-2xs font-mono text-signal-err">
          no se pudo quitar el contacto: {(removeMember.error as Error).message}
        </p>
      )}

      <Modal
        open={showAdd}
        onClose={closeModal}
        eyebrow="/ add to segment"
        title="Agregar contactos"
        size="lg"
        footer={
          mode === 'manual' ? (
            <>
              <Button variant="secondary" onClick={closeModal}>
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
          ) : (
            <>
              <Button variant="secondary" onClick={closeModal}>
                {bulkResult ? 'cerrar' : 'cancel'}
              </Button>
              <Button
                loading={bulkAdd.isPending}
                disabled={
                  !validBulkLimit ||
                  bulkAdd.isPending ||
                  (preview.data?.matched ?? 0) === 0 ||
                  bulkResult !== null
                }
                onClick={() => bulkAdd.mutate()}
              >
                agregar{preview.data ? ` (${preview.data.matched})` : ''}
              </Button>
            </>
          )
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2 border-b border-line pb-3">
            <button
              type="button"
              onClick={() => {
                setMode('manual');
                setBulkResult(null);
              }}
              className={`px-3 py-1.5 text-2xs uppercase tracking-widest font-mono transition-colors ${
                mode === 'manual'
                  ? 'text-accent border-b-2 border-accent -mb-[13px]'
                  : 'text-ink-muted hover:text-ink-secondary'
              }`}
            >
              elegir uno por uno
            </button>
            <button
              type="button"
              onClick={() => setMode('bulk')}
              className={`px-3 py-1.5 text-2xs uppercase tracking-widest font-mono transition-colors ${
                mode === 'bulk'
                  ? 'text-accent border-b-2 border-accent -mb-[13px]'
                  : 'text-ink-muted hover:text-ink-secondary'
              }`}
            >
              agregar varios de una
            </button>
          </div>

          {mode === 'manual' && (
            <>
              <p className="text-2xs font-mono text-ink-muted">
                buscá y tildá los contactos que querés sumar. el listado se va cargando a medida
                que scrolleás.
              </p>
              <Input
                placeholder="buscar contactos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="surface-overlay max-h-80 overflow-y-auto divide-y divide-line">
                {candidateItems.map((c) => {
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
                {candidateItems.length === 0 && !candidates.isLoading && (
                  <p className="px-4 py-6 text-center text-2xs uppercase tracking-widest font-mono text-ink-muted">
                    — sin resultados —
                  </p>
                )}
                {candidates.hasNextPage && (
                  <div
                    ref={candidatesSentinelRef}
                    className="px-4 py-3 text-center text-2xs uppercase tracking-widest font-mono text-ink-muted"
                  >
                    {candidates.isFetchingNextPage
                      ? '— cargando más... —'
                      : '— scrollear para ver más —'}
                  </div>
                )}
              </div>
              {add.isError && (
                <p className="text-2xs font-mono text-signal-err">{(add.error as Error).message}</p>
              )}
            </>
          )}

          {mode === 'bulk' && (
            <div className="space-y-4">
              <p className="text-2xs font-mono text-ink-muted">
                agregá los primeros N contactos que matcheen el filtro (o todos si dejás vacío). no
                hay tope — podés agregar miles de una.
              </p>
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <div className="space-y-1.5">
                  <label className="block text-2xs uppercase tracking-widest font-mono text-ink-muted">
                    filtro (opcional)
                  </label>
                  <Input
                    placeholder="phone, name o email..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setBulkResult(null);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-2xs uppercase tracking-widest font-mono text-ink-muted">
                    cantidad
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={Number.isFinite(bulkLimit) ? bulkLimit : ''}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setBulkLimit(Number.isNaN(n) ? 0 : n);
                      setBulkResult(null);
                    }}
                  />
                </div>
              </div>

              {!validBulkLimit && (
                <p className="text-2xs font-mono text-signal-err">
                  cantidad debe ser mayor o igual a 1
                </p>
              )}

              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={onlyWithoutList}
                  onChange={(e) => {
                    setOnlyWithoutList(e.target.checked);
                    setBulkResult(null);
                  }}
                  className="accent-accent"
                />
                <span className="text-ink-primary">
                  solo contactos que no pertenezcan a ninguna lista
                </span>
              </label>

              <div className="surface-overlay px-4 py-3 text-sm space-y-1">
                {validBulkLimit && preview.isLoading && (
                  <p className="text-2xs uppercase tracking-widest font-mono text-ink-muted">
                    — calculando preview... —
                  </p>
                )}
                {validBulkLimit && preview.data && (
                  <>
                    <p className="text-ink-primary">
                      se agregarán{' '}
                      <span className="font-mono text-accent">{preview.data.matched}</span>{' '}
                      contactos nuevos
                    </p>
                    {preview.data.matched < bulkLimit && (
                      <p className="text-2xs font-mono text-ink-muted">
                        pediste {bulkLimit} pero solo hay {preview.data.matched} contactos
                        disponibles que matcheen y no estén ya en la lista
                      </p>
                    )}
                  </>
                )}
                {validBulkLimit && preview.isError && (
                  <p className="text-2xs font-mono text-signal-err">
                    error en preview: {(preview.error as Error).message}
                  </p>
                )}
              </div>

              {bulkResult && (
                <div className="surface-overlay px-4 py-3 text-sm border-l-2 border-accent">
                  <p className="text-ink-primary">
                    agregados <span className="font-mono text-accent">{bulkResult.added}</span> de{' '}
                    <span className="font-mono">{bulkResult.requested}</span> solicitados
                  </p>
                  {bulkResult.added < bulkResult.requested && (
                    <p className="mt-1 text-2xs font-mono text-ink-muted">
                      el resto no se agregó porque no había suficientes contactos disponibles
                    </p>
                  )}
                </div>
              )}

              {bulkAdd.isError && (
                <p className="text-2xs font-mono text-signal-err">
                  {(bulkAdd.error as Error).message}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
