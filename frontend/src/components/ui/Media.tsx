import { useId, useState } from 'react';
import { assetUrl } from '@/lib/api';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

const CATEGORY_TINT: Record<string, string> = {
  technology: '#C7F36B',
  music: '#F2A65A',
  workshops: '#8AB4F8',
  art: '#E58FB5',
  business: '#D9D5CA',
  sports: '#7FD1B9',
  community: '#F2C14E',
};

/**
 * Event imagery with a designed typographic fallback (category initial on a tinted field)
 * when no image is set or it fails to load — never a broken-image icon.
 */
export function Cover({
  src,
  alt,
  category,
  className,
  imgClassName,
  eager,
}: {
  src: string | null | undefined;
  alt: string;
  category?: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const pid = useId().replace(/:/g, '');
  const url = assetUrl(src);
  const tint = CATEGORY_TINT[category ?? ''] ?? '#969696';
  return (
    <div className={cn('relative overflow-hidden bg-ink-700', className)}>
      {url && !failed ? (
        <img
          src={url}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          className={cn('h-full w-full object-cover', imgClassName)}
        />
      ) : (
        <div className="absolute inset-0 flex items-end p-5" style={{ background: `linear-gradient(160deg, ${tint}22, #141414 70%)` }} role="img" aria-label={alt}>
          <svg className="absolute inset-0 h-full w-full opacity-[0.18]" aria-hidden>
            <defs>
              <pattern id={`p-${pid}`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="14" stroke={tint} strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#p-${pid})`} />
          </svg>
          <span className="relative font-display text-[clamp(3rem,9vw,7rem)] font-medium leading-none tracking-tightest" style={{ color: tint }}>
            {(category ?? alt).slice(0, 1).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}

export function Avatar({ name, src, size = 36, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = assetUrl(src);
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-ink-700 font-medium text-bone/85', className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
      aria-hidden
    >
      {url && !failed ? <img src={url} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} /> : initials(name)}
    </span>
  );
}
