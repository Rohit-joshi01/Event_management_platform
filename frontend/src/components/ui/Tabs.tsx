import { motion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Underline tabs with a shared-layout indicator. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="tablist" className={cn('scrollbar-none flex gap-6 overflow-x-auto border-b border-line', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative -mb-px flex shrink-0 items-center gap-2 pb-3 pt-1 text-sm transition-colors',
              active ? 'text-bone' : 'text-mute hover:text-bone/80',
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className={cn('tnum rounded-sm px-1.5 text-[11px]', active ? 'bg-volt text-ink' : 'bg-ink-700 text-mute')}>{item.count}</span>
            ) : null}
            {active ? (
              <motion.span layoutId={`tab-${id}`} className="absolute inset-x-0 -bottom-px h-[2px] bg-volt" transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Compact segmented control for filters. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded border border-line bg-ink-850 p-0.5">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.value)}
            className={cn('relative h-8 rounded-sm px-3 text-[13px] transition-colors', active ? 'text-ink' : 'text-mute hover:text-bone')}
          >
            {active ? (
              <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-sm bg-bone" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} />
            ) : null}
            <span className="relative">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
