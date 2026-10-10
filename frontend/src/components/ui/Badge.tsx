import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'volt' | 'warn' | 'danger' | 'info' | 'muted';

const tones: Record<Tone, string> = {
  neutral: 'border-line-strong text-bone/85',
  volt: 'border-volt/40 text-volt',
  warn: 'border-signal-warn/40 text-signal-warn',
  danger: 'border-signal-danger/45 text-[#ff9c92]',
  info: 'border-signal-info/40 text-signal-info',
  muted: 'border-line text-mute',
};

const dots: Record<Tone, string> = {
  neutral: 'bg-bone/70',
  volt: 'bg-volt',
  warn: 'bg-signal-warn',
  danger: 'bg-signal-danger',
  info: 'bg-signal-info',
  muted: 'bg-mute-700',
};

export function Badge({ tone = 'neutral', children, dot = true, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 text-[11px] font-medium uppercase tracking-[0.08em]',
        tones[tone],
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

const statusMap: Record<string, { tone: Tone; label: string }> = {
  DRAFT: { tone: 'muted', label: 'Draft' },
  PENDING: { tone: 'warn', label: 'In review' },
  PUBLISHED: { tone: 'volt', label: 'Live' },
  REJECTED: { tone: 'danger', label: 'Changes requested' },
  CANCELLED: { tone: 'danger', label: 'Cancelled' },
  COMPLETED: { tone: 'neutral', label: 'Completed' },
  ENDED: { tone: 'neutral', label: 'Completed' },
  AVAILABLE: { tone: 'volt', label: 'On sale' },
  LIMITED: { tone: 'warn', label: 'Few left' },
  SOLD_OUT: { tone: 'danger', label: 'Sold out' },
  CLOSED: { tone: 'muted', label: 'Closed' },
  CONFIRMED: { tone: 'volt', label: 'Confirmed' },
  VALID: { tone: 'volt', label: 'Valid' },
  CHECKED_IN: { tone: 'info', label: 'Checked in' },
  ACTIVE: { tone: 'volt', label: 'Active' },
  SUSPENDED: { tone: 'danger', label: 'Suspended' },
  NOT_REQUIRED: { tone: 'muted', label: 'Free' },
  SIMULATED_PAID: { tone: 'info', label: 'Dev checkout' },
  SIMULATED_REFUNDED: { tone: 'muted', label: 'Dev refund' },
  PAID: { tone: 'volt', label: 'Paid' },
  REFUNDED: { tone: 'muted', label: 'Refunded' },
  APPROVED: { tone: 'volt', label: 'Approved' },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = statusMap[status] ?? { tone: 'neutral' as Tone, label: status };
  return (
    <Badge tone={s.tone} className={className}>
      {s.label}
    </Badge>
  );
}

/** Derives the organizer-facing status: published events that have ended read as Completed. */
export function lifecycleStatus(e: { status: string; endsAt: string }) {
  if (e.status === 'PUBLISHED' && new Date(e.endsAt).getTime() < Date.now()) return 'COMPLETED';
  return e.status;
}
