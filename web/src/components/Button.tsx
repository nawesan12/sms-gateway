import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
};

export function Button({ variant = 'primary', loading, children, disabled, className, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${VARIANT_CLASS[variant]} ${className ?? ''}`}
    >
      {loading ? (
        <span className="inline-flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-current animate-pulse-dot" />
          <span className="w-1 h-1 rounded-full bg-current animate-pulse-dot [animation-delay:200ms]" />
          <span className="w-1 h-1 rounded-full bg-current animate-pulse-dot [animation-delay:400ms]" />
        </span>
      ) : (
        children
      )}
    </button>
  );
}
