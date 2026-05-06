import type { ReactNode } from 'react';

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
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-up"
      onClick={onClose}
    >
      <div
        className={`surface w-full ${SIZE[size]} max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
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
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="border-t border-line px-5 py-3.5 flex justify-end gap-2 bg-canvas/40">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
