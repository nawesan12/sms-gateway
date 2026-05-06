import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { devicesApi } from '@/api/devices';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';

export function DevicesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', textbeeDeviceId: '', apiKey: '', priority: 100 });

  const list = useQuery({ queryKey: ['devices'], queryFn: devicesApi.list, refetchInterval: 10_000 });

  const create = useMutation({
    mutationFn: devicesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      setShowCreate(false);
      setForm({ name: '', textbeeDeviceId: '', apiKey: '', priority: 100 });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => devicesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  });

  const reactivate = useMutation({
    mutationFn: (id: string) => devicesApi.update(id, { status: 'ACTIVE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  });

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between border-b border-line pb-6">
        <div>
          <p className="section-eyebrow mb-2">— hardware fleet · TextBee</p>
          <h1 className="font-display text-6xl leading-none">
            Devices<span className="text-accent">.</span>
          </h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Register</Button>
      </header>

      {list.data && list.data.items.length === 0 ? (
        <EmptyState
          title="Sin dispositivos"
          hint="Registrá un Android para empezar a transmitir SMS."
          action={<Button onClick={() => setShowCreate(true)}>Registrar primero</Button>}
        />
      ) : (
        <div className="surface overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>name</th>
                <th>textbee id</th>
                <th>status</th>
                <th>circuit</th>
                <th>prio</th>
                <th>battery</th>
                <th className="text-right">actions</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.items.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span className="font-medium text-ink-primary">{d.name}</span>
                  </td>
                  <td className="font-mono text-xs text-ink-secondary">{d.textbeeDeviceId}</td>
                  <td>
                    <Badge>{d.status}</Badge>
                  </td>
                  <td>
                    <Badge>{d.circuitState}</Badge>
                  </td>
                  <td className="font-mono text-ink-secondary tabular">{d.priority}</td>
                  <td className="font-mono text-ink-secondary tabular">
                    {d.batteryLevel != null ? `${d.batteryLevel}%` : '—'}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {d.status !== 'ACTIVE' && (
                        <Button variant="secondary" onClick={() => reactivate.mutate(d.id)}>
                          revive
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (confirm(`Eliminar ${d.name}?`)) remove.mutate(d.id);
                        }}
                      >
                        delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        eyebrow="/ register hardware"
        title="Nuevo dispositivo"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              cancel
            </Button>
            <Button
              loading={create.isPending}
              onClick={() => create.mutate(form)}
              disabled={!form.name || !form.textbeeDeviceId || !form.apiKey}
            >
              register
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="phone-mardelplata-1"
          />
          <Input
            label="TextBee device id"
            value={form.textbeeDeviceId}
            onChange={(e) => setForm({ ...form, textbeeDeviceId: e.target.value })}
            className="input-mono"
          />
          <Input
            label="API key"
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            className="input-mono"
            hint="se cifra con AES-256-GCM antes de guardarse"
          />
          <Input
            label="Prioridad (menor = más usado)"
            type="number"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
          />
          {create.isError && (
            <p className="text-2xs font-mono text-signal-err">{(create.error as Error).message}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
