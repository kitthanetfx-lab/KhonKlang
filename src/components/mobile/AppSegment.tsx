'use client';

type Item<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  items: Item<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
  columns?: number;
};

export function AppSegment<T extends string>({
  items,
  value,
  onChange,
  ariaLabel = 'มุมมอง',
  columns,
}: Props<T>) {
  const cols = columns ?? Math.min(items.length, 4);
  return (
    <div
      className="app-seg"
      role="tablist"
      aria-label={ariaLabel}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {items.map(it => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={value === it.id}
          className={value === it.id ? 'is-on' : undefined}
          onClick={() => onChange(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export default AppSegment;
