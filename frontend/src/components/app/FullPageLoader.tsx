import { Logo } from '@/components/ui/Logo';

export function FullPageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-4">
        <Logo mark className="animate-pulse" />
        <div className="h-px w-24 overflow-hidden bg-line">
          <div className="h-full w-1/3 animate-shimmer bg-volt" />
        </div>
      </div>
    </div>
  );
}
