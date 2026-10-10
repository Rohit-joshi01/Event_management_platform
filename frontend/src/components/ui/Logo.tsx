import { cn } from '@/lib/cn';

/** AFTR wordmark: an open apex (the "A" as a doorway) with the accent dot as the person walking through. */
export function Logo({ className, mark = false }: { className?: string; mark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-bone', className)} aria-label="AFTR">
      <svg viewBox="0 0 32 32" className="h-[22px] w-[22px]" aria-hidden>
        <path d="M5 27 L16 5 L27 27" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="miter" />
        <circle cx="16" cy="21" r="3" fill="#C7F36B" />
      </svg>
      {mark ? null : <span className="font-display text-[19px] font-semibold tracking-[-0.04em]">AFTR</span>}
    </span>
  );
}
