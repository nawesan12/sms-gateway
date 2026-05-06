import { useRef, useState } from 'react';

interface Props {
  onFile: (csv: string) => void;
  disabled?: boolean;
}

export function CsvDropzone({ onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onFile(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) readFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer flex flex-col items-center justify-center px-6 py-12 text-center
        border border-dashed transition-colors
        ${disabled ? 'opacity-40 pointer-events-none' : ''}
        ${drag ? 'border-accent bg-accent/5' : 'border-line-strong bg-canvas-input hover:bg-canvas-overlay'}`}
    >
      <div className="absolute inset-2 pointer-events-none crosshair opacity-30" />
      <div className="relative">
        <p className="section-eyebrow mb-2">CSV upload</p>
        <p className="font-display text-2xl text-ink-primary">Arrastrá un archivo</p>
        <p className="mt-2 text-2xs font-mono uppercase tracking-widest text-ink-muted">
          o click para elegir · columnas: phone (req), name, email
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
