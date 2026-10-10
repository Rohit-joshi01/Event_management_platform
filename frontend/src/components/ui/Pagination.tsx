import { ChevronLeft, ChevronRight } from 'lucide-react';
import { num } from '@/lib/format';

export function Pagination({
  page,
  totalPages,
  totalElements,
  size,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  size: number;
  onChange: (p: number) => void;
}) {
  if (totalElements === 0) return null;
  const from = page * size + 1;
  const to = Math.min(totalElements, (page + 1) * size);
  return (
    <nav className="flex items-center justify-between gap-4 pt-4 text-[13px] text-mute" aria-label="Pagination">
      <p className="tnum">
        {num(from)}–{num(to)} of {num(totalElements)}
      </p>
      <div className="flex items-center gap-1">
        <button
          className="flex h-8 w-8 items-center justify-center rounded border border-line hover:border-line-strong hover:text-bone disabled:opacity-30"
          onClick={() => onChange(page - 1)}
          disabled={page <= 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="tnum px-2 text-bone/80">
          {page + 1} / {Math.max(totalPages, 1)}
        </span>
        <button
          className="flex h-8 w-8 items-center justify-center rounded border border-line hover:border-line-strong hover:text-bone disabled:opacity-30"
          onClick={() => onChange(page + 1)}
          disabled={page + 1 >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
