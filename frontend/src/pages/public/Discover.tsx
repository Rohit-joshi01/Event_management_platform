import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { api, type EventSearch } from '@/lib/api';
import { EventCard, EventCardSkeleton, EventRow, FeatureCard } from '@/components/events/EventCards';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { num } from '@/lib/format';
import { cn } from '@/lib/cn';

type DatePreset = '' | 'today' | 'weekend' | 'week' | 'month';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: '', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: 'weekend', label: 'This weekend' },
  { value: 'week', label: 'Next 7 days' },
  { value: 'month', label: 'Next 30 days' },
];

const SORTS = [
  { value: 'date', label: 'Soonest' },
  { value: 'popular', label: 'Trending' },
  { value: 'newest', label: 'Just announced' },
  { value: 'price', label: 'Lowest price' },
] as const;

function dateRange(preset: DatePreset): { from?: string; to?: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  switch (preset) {
    case 'today': {
      const end = startOfDay(now);
      end.setDate(end.getDate() + 1);
      return { from: startOfDay(now).toISOString(), to: end.toISOString() };
    }
    case 'weekend': {
      const d = startOfDay(now);
      const day = d.getDay(); // 0 Sun … 6 Sat
      const sat = new Date(d);
      if (day === 0) sat.setDate(d.getDate() - 1);
      else sat.setDate(d.getDate() + (6 - day));
      const mon = new Date(sat);
      mon.setDate(sat.getDate() + 2);
      return { from: (sat < now ? now : sat).toISOString(), to: mon.toISOString() };
    }
    case 'week': {
      const to = new Date(now);
      to.setDate(to.getDate() + 7);
      return { from: now.toISOString(), to: to.toISOString() };
    }
    case 'month': {
      const to = new Date(now);
      to.setDate(to.getDate() + 30);
      return { from: now.toISOString(), to: to.toISOString() };
    }
    default:
      return {};
  }
}

export default function Discover() {
  useDocumentTitle('Discover events');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const city = params.get('city') ?? '';
  const when = (params.get('when') ?? '') as DatePreset;
  const price = (params.get('price') ?? '') as '' | 'free' | 'paid';
  const sort = (params.get('sort') ?? 'date') as EventSearch['sort'];
  const [draft, setDraft] = useState(q);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => setDraft(q), [q]);

  // Debounced search-as-you-type.
  useEffect(() => {
    if (draft === q) return;
    const t = window.setTimeout(() => update({ q: draft }), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const meta = useQuery({ queryKey: ['events', 'meta'], queryFn: api.events.meta });
  const search = useMemo<EventSearch>(() => ({ q, category, city, price, sort, ...dateRange(when) }), [q, category, city, price, sort, when]);
  const results = useInfiniteQuery({
    queryKey: ['events', 'search', search],
    queryFn: ({ pageParam }) => api.events.search({ ...search, page: pageParam, size: 12 }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.last ? undefined : last.page + 1),
  });
  const filtered = Boolean(q || category || city || when || price || sort !== 'date');
  const trending = useQuery({ queryKey: ['events', 'popular', 4], queryFn: () => api.events.search({ sort: 'popular', size: 4 }), enabled: !filtered });

  const events = results.data?.pages.flatMap((p) => p.content) ?? [];
  const total = results.data?.pages[0]?.totalElements ?? 0;
  const activeCategory = meta.data?.categories.find((c) => c.slug === category);
  const activeCount = [category, city, when, price].filter(Boolean).length;

  return (
    <div className="pb-24 pt-[calc(var(--nav-h)+3rem)]">
      <header className="container-x">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="eyebrow mb-5">The programme</p>
            <h1 className="font-display text-giant font-medium">
              {activeCategory ? (
                <>
                  {activeCategory.name}
                  <span className="text-volt">.</span>
                </>
              ) : (
                <>
                  What’s <span className="font-serif font-normal italic tracking-normal">on</span>
                  {city ? <> in {city}</> : null}
                  <span className="text-volt">.</span>
                </>
              )}
            </h1>
          </div>
          <p className="max-w-sm text-[15px] leading-relaxed text-mute lg:col-span-4 lg:justify-self-end">
            {activeCategory?.description ?? 'Every published event on AFTR, updated as organizers go live. Search by name, venue, city or host.'}
          </p>
        </div>

        {/* Search + filters */}
        <div className="sticky top-[var(--nav-h)] z-30 -mx-4 mt-10 border-y border-line bg-ink/90 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Search events</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Search events, venues, cities or hosts"
                className="h-11 w-full rounded border border-line bg-ink-850 pl-10 pr-10 text-[14px] placeholder:text-mute-700 focus:border-volt/60 focus:outline-none focus:ring-2 focus:ring-volt/15"
              />
              {draft ? (
                <button onClick={() => setDraft('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-mute hover:text-bone" aria-label="Clear search">
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn('flex h-11 items-center gap-2 rounded border px-4 text-[13.5px] lg:hidden', filtersOpen ? 'border-volt/60 text-bone' : 'border-line text-bone/80')}
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters{activeCount ? <span className="tnum rounded-sm bg-volt px-1.5 text-[11px] text-ink">{activeCount}</span> : null}
              </button>
              <FilterSelect label="Sort" value={sort ?? 'date'} onChange={(v) => update({ sort: v === 'date' ? '' : v })} options={SORTS.map((s) => ({ value: s.value, label: s.label }))} />
            </div>
          </div>
          <div className={cn('mt-3 flex-wrap items-center gap-2 lg:flex', filtersOpen ? 'flex' : 'hidden')}>
            <FilterSelect
              label="Category"
              value={category}
              onChange={(v) => update({ category: v })}
              options={[{ value: '', label: 'All categories' }, ...(meta.data?.categories ?? []).map((c) => ({ value: c.slug, label: `${c.name} (${c.upcomingCount})` }))]}
            />
            <FilterSelect label="City" value={city} onChange={(v) => update({ city: v })} options={[{ value: '', label: 'All cities' }, ...(meta.data?.cities ?? []).map((c) => ({ value: c, label: c }))]} />
            <FilterSelect label="Date" value={when} onChange={(v) => update({ when: v })} options={DATE_PRESETS} />
            <FilterSelect
              label="Price"
              value={price}
              onChange={(v) => update({ price: v })}
              options={[
                { value: '', label: 'Any price' },
                { value: 'free', label: 'Free' },
                { value: 'paid', label: 'Paid' },
              ]}
            />
            {filtered ? (
              <button onClick={() => setParams(new URLSearchParams(), { replace: true })} className="h-9 px-3 text-[13px] text-mute hover:text-bone">
                Clear all
              </button>
            ) : null}
            <p className="tnum ml-auto text-[13px] text-mute" aria-live="polite">
              {results.isLoading ? 'Searching…' : `${num(total)} ${total === 1 ? 'event' : 'events'}`}
            </p>
          </div>
        </div>

        {/* Category chips */}
        <div className="scrollbar-none -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {[{ slug: '', name: 'Everything' }, ...(meta.data?.categories ?? [])].map((c) => (
            <button
              key={c.slug}
              onClick={() => update({ category: c.slug })}
              className={cn(
                'relative h-9 shrink-0 rounded-full border px-4 text-[13px] transition-colors',
                category === c.slug ? 'border-bone text-ink' : 'border-line text-bone/75 hover:border-line-strong hover:text-bone',
              )}
            >
              {category === c.slug ? <motion.span layoutId="chip" className="absolute inset-0 rounded-full bg-bone" transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} /> : null}
              <span className="relative">{c.name}</span>
            </button>
          ))}
        </div>
      </header>

      <section className="container-x mt-12" aria-label="Results">
        {results.isError ? (
          <ErrorState error={results.error} onRetry={() => results.refetch()} />
        ) : results.isLoading ? (
          <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<Search className="h-4 w-4" />}
            title="Nothing matches those filters"
            body="Try a wider date range, another city, or clear the filters to see everything that’s on."
            action={
              <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <ResultsGrid events={events} />
        )}

        {results.hasNextPage ? (
          <div className="mt-16 flex justify-center">
            <Button variant="secondary" size="lg" loading={results.isFetchingNextPage} onClick={() => results.fetchNextPage()}>
              Show more events
            </Button>
          </div>
        ) : null}
      </section>

      {!filtered && trending.data?.content.length ? (
        <section className="container-x mt-28" aria-labelledby="trending-title">
          <div className="mb-6 flex items-end justify-between">
            <h2 id="trending-title" className="font-display text-huge font-medium">
              Trending
            </h2>
            <p className="eyebrow">By tickets claimed</p>
          </div>
          {trending.data.content.map((e, i) => (
            <EventRow key={e.id} e={e} index={i} />
          ))}
          <div className="border-t border-line" />
        </section>
      ) : null}
    </div>
  );
}

function ResultsGrid({ events }: { events: Parameters<typeof EventCard>[0]['e'][] }) {
  const [first, second, ...rest] = events;
  return (
    <div className="grid gap-x-8 gap-y-16 lg:grid-cols-12">
      {first ? (
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="lg:col-span-7">
          <FeatureCard e={first} priority />
        </motion.div>
      ) : null}
      {second ? (
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }} className="lg:col-span-4 lg:col-start-9 lg:pt-20">
          <EventCard e={second} aspect="aspect-[4/5]" />
        </motion.div>
      ) : null}
      {rest.length ? (
        <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:col-span-12 lg:grid-cols-3">
          {rest.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className={cn(i % 3 === 1 && 'lg:translate-y-10')}
            >
              <EventCard e={e} />
            </motion.div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly { value: string; label: string }[] }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 appearance-none rounded border bg-ink-850 pl-3 pr-8 text-[13px] focus:border-volt/60 focus:outline-none lg:h-9',
          value ? 'border-bone/50 text-bone' : 'border-line text-bone/75',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-mute" viewBox="0 0 12 12" aria-hidden>
        <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </label>
  );
}
