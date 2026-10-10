import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Panel({
  title,
  eyebrow,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('rounded-md border border-line bg-ink-800', className)}>
      {title || action ? (
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
            {title ? <h2 className="font-display text-[15px] font-medium tracking-tight">{title}</h2> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
