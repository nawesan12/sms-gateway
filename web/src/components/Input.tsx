import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: string;
}

export function Input({ label, error, hint, prefix, className, ...rest }: Props) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className={prefix ? 'flex' : ''}>
        {prefix && (
          <span className="flex items-center px-3 bg-canvas-overlay border border-line border-r-0 text-2xs uppercase tracking-widest font-mono text-ink-muted">
            {prefix}
          </span>
        )}
        <input {...rest} className={`input ${className ?? ''}`} />
      </div>
      {hint && !error && <p className="mt-1.5 text-2xs font-mono text-ink-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-2xs font-mono text-signal-err">{error}</p>}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className, ...rest }: TextareaProps) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <textarea {...rest} className={`input resize-y ${className ?? ''}`} />
      {hint && !error && <p className="mt-1.5 text-2xs font-mono text-ink-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-2xs font-mono text-signal-err">{error}</p>}
    </div>
  );
}
