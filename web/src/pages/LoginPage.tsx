import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { setToken } from '@/api/client';

export function LoginPage() {
  const navigate = useNavigate();
  const [token, setT] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auto-login desde el link de acceso: /login?token=XYZ
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkToken = params.get('token');
    if (!linkToken) return;
    setToken(linkToken.trim());
    // Limpiar la URL para que el token no quede en history.
    window.history.replaceState({}, '', '/login');
    navigate('/', { replace: true });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token.trim()) {
      setError('Ingresá un token');
      return;
    }
    setSubmitting(true);
    setToken(token.trim());
    const isViteDev = import.meta.env.DEV && location.port === '5173';
    const url = isViteDev ? '/api/v1/devices' : '/v1/devices';
    try {
      // Probamos como Bearer (access token o JWT) y como bootstrap a la vez.
      const res = await fetch(url, {
        headers: {
          'x-bootstrap-token': token.trim(),
          authorization: `Bearer ${token.trim()}`,
        },
      });
      if (!res.ok) {
        setError('Token inválido');
        setSubmitting(false);
        return;
      }
      navigate('/');
    } catch {
      setError('No se puede contactar la API');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative grid lg:grid-cols-[1.2fr_1fr]">
      {/* ─── Hero ─── */}
      <section className="relative flex flex-col justify-between p-10 lg:p-14 overflow-hidden border-r border-line">
        <div className="absolute inset-0 crosshair opacity-40 pointer-events-none" />
        <div className="absolute -top-20 -left-20 w-[480px] h-[480px] bg-accent/[0.06] blur-3xl rounded-full pointer-events-none" />

        <header className="relative flex items-center justify-between text-2xs uppercase tracking-widest font-mono text-ink-muted">
          <span>◇ &nbsp;sms.gateway / operator console</span>
          <span>v0.1.0</span>
        </header>

        <div className="relative max-w-2xl">
          <p className="section-eyebrow mb-6">— LATAM bulk SMS · TextBee × Android</p>
          <h1 className="font-display text-6xl lg:text-8xl leading-[0.95] text-ink-primary text-balance">
            Mandá SMS a<br />
            <span className="italic">miles de</span> contactos.
            <span className="text-accent">.</span>
          </h1>
          <p className="mt-6 text-base text-ink-secondary max-w-md leading-relaxed">
            Listas. Campañas. Templates. Todo desde un Android físico. Sin Twilio. Sin minutos.
            Costos de la SIM y nada más.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-px bg-line max-w-md">
            {[
              { k: 'tps', v: '5/s' },
              { k: 'devices', v: 'multi' },
              { k: 'failover', v: 'auto' },
            ].map((s) => (
              <div key={s.k} className="bg-canvas px-4 py-3">
                <p className="text-2xs uppercase tracking-widest font-mono text-ink-muted">
                  {s.k}
                </p>
                <p className="font-display text-2xl text-ink-primary mt-0.5">{s.v}</p>
              </div>
            ))}
          </div>
        </div>

        <footer className="relative flex justify-between text-2xs uppercase tracking-widest font-mono text-ink-dim">
          <span>buenos aires · mar del plata</span>
          <span className="flex items-center gap-2">
            status
            <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-signal-ok">
              <span className="absolute inset-0 rounded-full bg-signal-ok animate-pulse-dot" />
            </span>
            ok
          </span>
        </footer>
      </section>

      {/* ─── Auth panel ─── */}
      <section className="flex items-center justify-center p-10 bg-canvas-elevated/40">
        <form onSubmit={submit} className="w-full max-w-md space-y-6 stagger">
          <div>
            <p className="section-eyebrow mb-2">/ authentication</p>
            <h2 className="font-display text-4xl leading-tight">
              Acceso de operador
              <span className="inline-block ml-1 w-3 h-7 bg-accent animate-blink align-middle" />
            </h2>
            <p className="mt-2 text-sm text-ink-secondary">
              Pegá tu bootstrap token. Si no lo tenés, pedile uno al admin.
            </p>
          </div>

          <Input
            label="Bootstrap token"
            type="password"
            autoComplete="off"
            autoFocus
            value={token}
            onChange={(e) => setT(e.target.value)}
            placeholder="••••••••••••••••"
            error={error ?? undefined}
            className="input-mono"
          />

          <Button type="submit" loading={submitting} className="w-full justify-between">
            <span>Entrar</span>
            <span className="text-accent-fg/60">→</span>
          </Button>

          <div className="border-t border-line pt-4 text-2xs uppercase tracking-widest font-mono text-ink-muted leading-relaxed">
            <p>tip · header `x-bootstrap-token`</p>
            <p>tip · session vive en localStorage</p>
          </div>
        </form>
      </section>
    </div>
  );
}
