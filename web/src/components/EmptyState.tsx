import type { ReactNode } from 'react';

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface crosshair flex flex-col items-center justify-center gap-3 px-6 py-20 text-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-canvas/0 via-canvas-elevated/40 to-canvas-elevated" />
      <div className="relative">
        <p className="section-eyebrow mb-2">— empty —</p>
        <p className="font-display text-3xl text-ink-primary leading-tight">{title}</p>
        {hint && <p className="mt-2 max-w-md text-sm text-ink-secondary">{hint}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}
