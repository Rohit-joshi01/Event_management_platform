import type { ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Button } from './Button';
import { cn } from '@/lib/cn';

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-3 rounded-md border border-dashed border-line-strong px-6 py-10 sm:items-center sm:text-center', className)}>
      {icon ? <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-mute">{icon}</div> : null}
      <div>
        <p className="font-display text-lg tracking-tight">{title}</p>
        {body ? <p className="mt-1 max-w-md text-sm leading-relaxed text-mute">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof ApiError ? error.message : 'Something unexpected happened.';
  const title =
    error instanceof ApiError && error.isForbidden
      ? 'You don’t have access to this'
      : error instanceof ApiError && error.isNotFound
        ? 'Not found'
        : error instanceof ApiError && error.status === 0
          ? 'Can’t reach the server'
          : 'Couldn’t load this';
  return (
    <div role="alert" className={cn('flex flex-col items-start gap-3 rounded-md border border-signal-danger/25 bg-signal-danger/[0.04] px-6 py-8', className)}>
      <AlertTriangle className="h-5 w-5 text-signal-danger" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-mute">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" icon={<RotateCw className="h-3.5 w-3.5" />} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
