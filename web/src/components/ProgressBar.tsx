interface Props {
  value: number;
  max: number;
  label?: string;
  segments?: number;
}

/**
 * Segmented progress bar — operator console style.
 * Each cell lights up when the cumulative pct reaches it.
 */
export function ProgressBar({ value, max, label, segments = 32 }: Props) {
  const pct = max === 0 ? 0 : Math.min(100, (value / max) * 100);
  const filledCells = Math.round((pct / 100) * segments);

  return (
    <div>
      {label && (
        <div className="mb-2 flex justify-between items-baseline text-2xs uppercase tracking-widest font-mono">
          <span className="text-ink-muted">{label}</span>
          <span className="text-ink-primary tabular">
            {value}/{max}
            <span className="text-ink-muted ml-2">({pct.toFixed(1)}%)</span>
          </span>
        </div>
      )}
      <div className="flex gap-[2px]">
        {Array.from({ length: segments }).map((_, i) => {
          const filled = i < filledCells;
          return (
            <div
              key={i}
              className={`flex-1 h-2 transition-colors duration-200 ${
                filled ? 'bg-accent' : 'bg-line-subtle'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
