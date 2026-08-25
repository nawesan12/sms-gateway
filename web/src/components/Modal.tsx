import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
};

export function Modal({ open, onClose, title, eyebrow, children, footer, size = 'md' }: Props) {
  // Lock body scroll mientras el modal está abierto para que el scroll del
  // backdrop no haga doble-scroll con el body.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  // Portal a document.body para escapar del containing block del Layout
  // (el `animate-fade-up` de la página crea un transform que rompe `fixed`).
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`bg-canvas-overlay border border-line-strong shadow-2xl w-full ${SIZE[size]} max-h-[calc(100vh-2rem)] flex flex-col my-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            {eyebrow && <p className="section-eyebrow mb-1">{eyebrow}</p>}
            <h2 className="font-display text-2xl text-ink-primary leading-none">{title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="text-ink-muted hover:text-ink-primary text-xl leading-none px-2"
          >
            ×
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line px-5 py-3.5 flex justify-end gap-2 bg-canvas/40">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
