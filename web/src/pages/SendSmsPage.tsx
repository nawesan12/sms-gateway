import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { messagingApi } from '@/api/messaging';
import { contactsApi } from '@/api/contacts';
import { Button } from '@/components/Button';
import { Input, Textarea } from '@/components/Input';
import { Badge } from '@/components/Badge';

export function SendSmsPage() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [contactId, setContactId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lastSent, setLastSent] = useState<{ id: string; phone: string } | null>(null);

  const contactsQ = useQuery({
    queryKey: ['contacts', 'picker', search],
    queryFn: () => contactsApi.list({ search, pageSize: 10 }),
    enabled: search.length > 0,
  });

  const sendStatus = useQuery({
    queryKey: ['sms', lastSent?.id],
    queryFn: () => messagingApi.status(lastSent!.id),
    enabled: lastSent !== null,
    refetchInterval: 1500,
  });

  const send = useMutation({
    mutationFn: messagingApi.send,
    onSuccess: (out) => {
      setLastSent({ id: out.smsMessageId, phone: out.recipientE164 });
      setMessage('');
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !message.trim()) return;
    send.mutate({ phone: phone.trim(), message: message.trim(), contactId: contactId ?? undefined });
  };

  const charCount = message.length;
  const segments = Math.max(1, Math.ceil(charCount / 160));
  const charLimitColor =
    charCount > 1500 ? 'text-signal-err' : charCount > 160 ? 'text-signal-warn' : 'text-ink-muted';

  return (
    <div className="space-y-8">
      <header className="border-b border-line pb-6">
        <p className="section-eyebrow mb-2">— compose · single recipient</p>
        <h1 className="font-display text-6xl leading-none">
          Send <span className="italic text-accent">sms</span>.
        </h1>
        <p className="mt-3 text-sm text-ink-secondary max-w-lg">
          Mensaje libre. Sin templates. Lo que escribas acá llega tal cual al destinatario.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-px bg-line border border-line">
        {/* ─── Compose ─── */}
        <form onSubmit={submit} className="bg-canvas-elevated p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Teléfono · E.164"
              placeholder="+5491100000000"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setContactId(null);
              }}
              className="input-mono"
            />
            <Input
              label="O buscar contacto"
              placeholder="nombre o número"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {contactsQ.data && contactsQ.data.items.length > 0 && search.length > 0 && (
            <div className="surface-overlay max-h-44 overflow-y-auto divide-y divide-line">
              {contactsQ.data.items.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    setPhone(c.phoneE164);
                    setContactId(c.id);
                    setSearch('');
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-canvas/60 flex items-center gap-3"
                >
                  <span className="font-mono text-2xs text-ink-muted">→</span>
                  <span className="font-medium">{c.name ?? '(sin nombre)'}</span>
                  <span className="font-mono text-xs text-ink-secondary ml-auto">{c.phoneE164}</span>
                </button>
              ))}
            </div>
          )}

          <Textarea
            label="Mensaje"
            rows={7}
            maxLength={1600}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribí el mensaje exacto que querés enviar..."
            className="font-mono text-sm leading-relaxed"
          />

          <div className="flex items-center justify-between text-2xs uppercase tracking-widest font-mono">
            <span className={charLimitColor}>
              {charCount}/1600 chars · {segments} segment{segments > 1 ? 's' : ''}
            </span>
            <span className="text-ink-dim">gsm-7 / utf-16 · auto</span>
          </div>

          {send.isError && (
            <p className="text-2xs font-mono text-signal-err border border-signal-err/30 bg-signal-err/5 px-3 py-2">
              ✕ &nbsp; {(send.error as Error).message}
            </p>
          )}

          <Button type="submit" loading={send.isPending} disabled={!phone || !message}>
            Transmitir →
          </Button>
        </form>

        {/* ─── Status pane ─── */}
        <div className="bg-canvas/60 p-8 relative">
          <p className="section-eyebrow">/ last transmission</p>
          {!lastSent ? (
            <div className="mt-12 text-center">
              <p className="font-display text-3xl text-ink-muted leading-tight">
                Sin envíos<br />en esta sesión
              </p>
              <p className="mt-3 text-2xs font-mono uppercase tracking-widest text-ink-dim">
                el resultado va a aparecer acá ↘
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-2xs uppercase tracking-widest font-mono text-ink-muted">recipient</p>
                <p className="font-mono text-lg text-ink-primary mt-0.5">{lastSent.phone}</p>
              </div>
              <div>
                <p className="text-2xs uppercase tracking-widest font-mono text-ink-muted">status</p>
                <div className="mt-1.5">
                  <Badge>{sendStatus.data?.status ?? 'PENDING'}</Badge>
                </div>
              </div>
              {sendStatus.data?.textbeeMessageId && (
                <div>
                  <p className="text-2xs uppercase tracking-widest font-mono text-ink-muted">provider id</p>
                  <p className="font-mono text-xs text-ink-secondary mt-0.5 break-all">
                    {sendStatus.data.textbeeMessageId}
                  </p>
                </div>
              )}
              {sendStatus.data?.errorMessage && (
                <div>
                  <p className="text-2xs uppercase tracking-widest font-mono text-signal-err">error</p>
                  <p className="font-mono text-xs text-signal-err mt-0.5">{sendStatus.data.errorMessage}</p>
                </div>
              )}
              <div className="pt-4 border-t border-line">
                <p className="text-2xs font-mono text-ink-dim">
                  msgId · <span className="text-ink-secondary break-all">{lastSent.id}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
