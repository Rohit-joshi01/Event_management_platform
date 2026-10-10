import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { gsap, prefersReducedMotion } from '@/lib/gsap';
import type { Category, EventSummary } from '@/lib/types';
import { Cover } from '@/components/ui/Media';
import { ButtonLink } from '@/components/ui/Button';
import { EventCard, EventRow, FeatureCard } from '@/components/events/EventCards';
import { dayMonth, num, priceLabel, time, where } from '@/lib/format';
import { cn } from '@/lib/cn';

// ============================================================================ 1. Pinned manifesto

const MANIFESTO =
  'Every great night starts as someone’s idea. AFTR gives that idea a room, a door, and a list of people who can’t wait to walk through it.';

export function Manifesto() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const words = gsap.utils.toArray<HTMLElement>('[data-word]');
      gsap.fromTo(
        words,
        { opacity: 0.14 },
        {
          opacity: 1,
          ease: 'none',
          stagger: 0.12,
          scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
        },
      );
      gsap.from('[data-pillar]', {
        y: 40,
        opacity: 0,
        stagger: 0.1,
        duration: 1.1,
        scrollTrigger: { trigger: '[data-pillars]', start: 'top 85%' },
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} id="about" className="relative bg-ink lg:h-[220vh]" aria-label="What AFTR is for">
      <div className="lg:sticky lg:top-0 lg:flex lg:h-screen lg:items-center">
        <div className="container-x py-24 lg:py-0">
          <div className="grid gap-10 lg:grid-cols-12">
            <p className="eyebrow lg:col-span-2 lg:pt-4">(01) — Manifesto</p>
            <p className="font-display text-huge font-medium lg:col-span-10" aria-label={MANIFESTO}>
              {MANIFESTO.split(' ').map((w, i) => (
                <span key={i} data-word aria-hidden className={cn('inline-block pr-[0.24em]', /AFTR/.test(w) && 'text-volt')}>
                  {w}
                </span>
              ))}
            </p>
          </div>
          <div data-pillars className="mt-16 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3 lg:ml-[16.66%]">
            {[
              ['Discover', 'An editorial programme of what’s on — filterable by date, city, category and price.'],
              ['Organize', 'Draft, ticket and submit events. Inventory is protected so nothing ever oversells.'],
              ['Operate', 'Approvals, check-in, announcements and an audit trail for every decision.'],
            ].map(([t, d], i) => (
              <div key={t} data-pillar className="bg-ink p-6">
                <p className="tnum text-[12px] text-mute-700">0{i + 1}</p>
                <p className="mt-6 font-display text-xl font-medium tracking-tight">{t}</p>
                <p className="mt-2 text-sm leading-relaxed text-mute">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================ 2. Parallax gallery

const TILES = [
  { cls: 'left-0 top-[6%] w-[44%] lg:w-[30%] aspect-[4/5]', speed: -0.25 },
  { cls: 'right-0 top-0 w-[46%] lg:w-[24%] aspect-[3/4]', speed: 0.18 },
  { cls: 'left-[8%] lg:left-[34%] top-[56%] lg:top-[48%] w-[40%] lg:w-[20%] aspect-square', speed: -0.42 },
  { cls: 'right-[4%] lg:right-[10%] top-[62%] lg:top-[58%] w-[48%] lg:w-[28%] aspect-[16/11]', speed: 0.32 },
  { cls: 'hidden lg:block left-[4%] top-[74%] w-[16%] aspect-[3/4]', speed: -0.12 },
];

export function ParallaxGallery({ events }: { events: EventSummary[] }) {
  const root = useRef<HTMLElement>(null);
  const picks = events.filter((e) => e.coverImageUrl).slice(0, TILES.length);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-speed]').forEach((tile) => {
        const speed = Number(tile.dataset.speed);
        gsap.fromTo(
          tile,
          { yPercent: speed * -60 },
          { yPercent: speed * 60, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } },
        );
      });
      gsap.from('[data-gallery-title] > span > span', {
        yPercent: 110,
        stagger: 0.08,
        duration: 1.2,
        scrollTrigger: { trigger: '[data-gallery-title]', start: 'top 80%' },
      });
    }, el);
    return () => ctx.revert();
  }, [picks.length]);

  if (picks.length < 3) return null;

  return (
    <section ref={root} className="relative overflow-hidden bg-ink py-24 lg:py-32" aria-label="Featured moments">
      <div className="container-x relative h-[150vw] sm:h-[110vw] lg:h-[96vh]">
        {picks.map((e, i) => (
          <Link key={e.id} to={`/events/${e.slug}`} data-speed={TILES[i]!.speed} className={cn('group absolute block', TILES[i]!.cls)}>
            <Cover src={e.coverImageUrl} alt={e.title} category={e.category.slug} className="h-full w-full rounded" imgClassName="transition-transform duration-[1400ms] ease-out-expo group-hover:scale-105" />
            <p className="mt-2 flex justify-between gap-3 text-[11.5px] text-mute">
              <span className="truncate text-bone/80">{e.title}</span>
              <span className="tnum shrink-0">{dayMonth(e.startsAt, e.timezone)}</span>
            </p>
          </Link>
        ))}
        <h2 data-gallery-title className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center font-display text-giant font-medium mix-blend-difference">
          <span className="block overflow-hidden">
            <span className="block">Things worth</span>
          </span>
          <span className="block overflow-hidden">
            <span className="block">
              leaving the <span className="font-serif font-normal italic tracking-normal">house</span> for
            </span>
          </span>
        </h2>
      </div>
    </section>
  );
}

// ============================================================================ 3. Category index

export function CategoryIndex({ categories, events }: { categories: Category[]; events: EventSummary[] }) {
  const root = useRef<HTMLElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const preview = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-cat-row]',
        { clipPath: 'inset(0 0 100% 0)', y: 30 },
        {
          clipPath: 'inset(0 0 0% 0)',
          y: 0,
          stagger: 0.07,
          duration: 1.1,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 70%' },
        },
      );
    }, el);
    return () => ctx.revert();
  }, [categories.length]);

  const onMove = (e: React.MouseEvent) => {
    if (!preview.current) return;
    const rect = root.current!.getBoundingClientRect();
    gsap.to(preview.current, { x: e.clientX - rect.left + 24, y: e.clientY - rect.top - 120, duration: 0.6, ease: 'power3.out' });
  };

  const coverFor = (slug: string) => events.find((e) => e.category.slug === slug && e.coverImageUrl);
  const hovered = hover ? coverFor(hover) : undefined;

  return (
    <section ref={root} className="relative bg-ink py-24 lg:py-36" onMouseMove={onMove} aria-labelledby="cat-title">
      <div className="container-x">
        <div className="mb-12 grid gap-6 lg:grid-cols-12">
          <p className="eyebrow lg:col-span-2">(02) — Index</p>
          <h2 id="cat-title" className="font-display text-huge font-medium lg:col-span-6">
            {(['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][categories.length] ?? categories.length) + ' ways to spend an evening.'}
          </h2>
          <p className="max-w-sm text-[15px] leading-relaxed text-mute lg:col-span-4 lg:justify-self-end lg:pt-3">
            Counts are live — they come straight from what organizers have published.
          </p>
        </div>
        <ul className="border-b border-line">
          {categories.map((c, i) => (
            <li key={c.slug} data-cat-row>
              <Link
                to={`/events?category=${c.slug}`}
                onMouseEnter={() => setHover(c.slug)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(c.slug)}
                onBlur={() => setHover(null)}
                className="group grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-4 border-t border-line py-5 transition-colors sm:grid-cols-[4rem_1fr_auto_auto] sm:py-7"
              >
                <span className="tnum text-[13px] text-mute-700">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-display text-[clamp(2rem,5.4vw,5rem)] font-medium leading-none tracking-[-0.045em] text-bone/90 transition-[color,transform] duration-500 ease-out-expo group-hover:translate-x-3 group-hover:text-volt">
                  {c.name}
                </span>
                <span className="hidden max-w-[260px] text-right text-[13px] leading-snug text-mute sm:block">{c.description}</span>
                <span className="tnum flex items-center gap-2 text-[14px] text-bone/80">
                  {num(c.upcomingCount)}
                  <ArrowUpRight className="h-4 w-4 text-mute transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-volt" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div
        ref={preview}
        className={cn(
          'pointer-events-none absolute left-0 top-0 z-20 hidden w-[260px] transition-opacity duration-300 lg:block',
          hovered ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden
      >
        {hovered ? <Cover src={hovered.coverImageUrl} alt="" category={hovered.category.slug} className="aspect-[4/5] rounded shadow-2xl" /> : null}
      </div>
    </section>
  );
}

// ============================================================================ 4. Featured spread → programme

export function Programme({ featured, soon }: { featured?: EventSummary; soon: EventSummary[] }) {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('[data-feature-img] img', { scale: 1.18 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '[data-feature-img]', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.from('[data-prog-item]', { y: 50, opacity: 0, stagger: 0.08, duration: 1.1, scrollTrigger: { trigger: '[data-prog-grid]', start: 'top 82%' } });
    }, el);
    return () => ctx.revert();
  }, [featured?.id, soon.length]);

  const rest = soon.filter((e) => e.id !== featured?.id);
  const grid = rest.slice(0, 2);
  const list = rest.slice(2, 7);

  return (
    <section ref={root} className="bg-ink pb-24 lg:pb-36" aria-labelledby="programme-title">
      {featured ? (
        <div className="container-x">
          <div className="mb-10 flex items-end justify-between gap-6 border-t border-line pt-8">
            <p className="eyebrow">(03) — Featured</p>
            <p className="eyebrow">{featured.category.name}</p>
          </div>
          <Link to={`/events/${featured.slug}`} className="group grid gap-8 lg:grid-cols-12 lg:gap-10">
            <div data-feature-img className="overflow-hidden rounded-md lg:col-span-8">
              <Cover src={featured.coverImageUrl} alt={featured.title} category={featured.category.slug} className="aspect-[16/10]" />
            </div>
            <div className="flex flex-col lg:col-span-4">
              <p className="tnum font-display text-[clamp(3rem,6vw,6rem)] font-medium leading-none tracking-[-0.05em] text-volt">{dayMonth(featured.startsAt, featured.timezone)}</p>
              <h3 className="mt-6 font-display text-[clamp(1.8rem,3vw,3rem)] font-medium leading-[1.02] tracking-[-0.035em] transition-colors group-hover:text-volt">{featured.title}</h3>
              <p className="mt-4 text-[15px] leading-relaxed text-mute">{featured.summary}</p>
              <dl className="mt-8 divide-y divide-line border-y border-line text-[14px]">
                {[
                  ['When', `${time(featured.startsAt, featured.timezone)} onwards`],
                  ['Where', where(featured)],
                  ['Hosted by', featured.organizerName],
                  ['Tickets', priceLabel(featured.minPriceCents)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-6 py-3">
                    <dt className="text-mute">{k}</dt>
                    <dd className="text-right text-bone/90">{v}</dd>
                  </div>
                ))}
              </dl>
              <span className="mt-6 inline-flex items-center gap-2 text-[14px] text-bone">
                <span className="link-underline">View event</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        </div>
      ) : null}

      <div className="container-x mt-28">
        <div className="mb-10 grid gap-6 lg:grid-cols-12">
          <p className="eyebrow lg:col-span-2">(04) — Programme</p>
          <h2 id="programme-title" className="font-display text-huge font-medium lg:col-span-7">
            Happening soon
          </h2>
          <div className="lg:col-span-3 lg:justify-self-end lg:self-end">
            <ButtonLink to="/events" variant="secondary" iconRight={<ArrowRight className="h-4 w-4" />}>
              Open the full programme
            </ButtonLink>
          </div>
        </div>
        <div data-prog-grid className="grid gap-x-8 gap-y-14 lg:grid-cols-12">
          {grid[0] ? (
            <div data-prog-item className="lg:col-span-7">
              <FeatureCard e={grid[0]} />
            </div>
          ) : null}
          {grid[1] ? (
            <div data-prog-item className="lg:col-span-4 lg:col-start-9 lg:pt-24">
              <EventCard e={grid[1]} aspect="aspect-[3/4]" />
            </div>
          ) : null}
          {list.length ? (
            <div data-prog-item className="lg:col-span-12">
              {list.map((e, i) => (
                <EventRow key={e.id} e={e} index={i} />
              ))}
              <div className="border-t border-line" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ============================================================================ 5. Closing CTA

export function ClosingCta({ cities }: { cities: string[] }) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-close-line]', { yPercent: 110, stagger: 0.1, duration: 1.3, scrollTrigger: { trigger: el, start: 'top 70%' } });
    }, el);
    return () => ctx.revert();
  }, []);
  return (
    <section ref={root} className="grain relative overflow-hidden border-t border-line bg-ink-850 py-28 lg:py-40" aria-labelledby="close-title">
      <div className="container-x">
        <h2 id="close-title" className="font-display text-mega font-medium">
          <span className="block overflow-hidden">
            <span data-close-line className="block">Your next</span>
          </span>
          <span className="block overflow-hidden">
            <span data-close-line className="block">
              night <span className="font-serif font-normal italic tracking-normal text-volt">out</span> is in
            </span>
          </span>
          <span className="block overflow-hidden">
            <span data-close-line className="block">here.</span>
          </span>
        </h2>
        <div className="mt-12 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/events" size="lg" iconRight={<ArrowUpRight className="h-4 w-4" />}>
              Explore Events
            </ButtonLink>
            <ButtonLink to="/sign-up" size="lg" variant="secondary">
              Create a free account
            </ButtonLink>
          </div>
          {cities.length ? (
            <p className="max-w-xl text-[14px] leading-relaxed text-mute lg:text-right">
              Currently programming in{' '}
              {cities.map((c, i) => (
                <span key={c}>
                  <Link to={`/events?city=${encodeURIComponent(c)}`} className="link-underline text-bone/85 hover:text-bone">
                    {c}
                  </Link>
                  {i < cities.length - 2 ? ', ' : i === cities.length - 2 ? ' and ' : '.'}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
