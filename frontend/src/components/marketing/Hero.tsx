import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Plus } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { ArmillaryFallback } from './ArmillaryFallback';

const HeroScene = lazy(() => import('./HeroScene').then((m) => ({ default: m.HeroScene })));
import { gsap, prefersReducedMotion, ScrollTrigger } from '@/lib/gsap';
import { detectSceneMode, type SceneMode } from '@/lib/webgl';
import { useMediaQuery } from '@/hooks/useReducedMotion';
import { useAuth } from '@/auth/AuthContext';
import type { EventMeta, EventSummary } from '@/lib/types';
import { dayMonth, num } from '@/lib/format';

const LINES = ['MAKE ROOM', 'FOR THE', 'UNEXPECTED.'];

export function Hero({ meta, next }: { meta?: EventMeta; next?: EventSummary }) {
  const root = useRef<HTMLElement>(null);
  const scroll = useRef(0);
  const [mode, setMode] = useState<SceneMode | null>(null);
  const [active, setActive] = useState(true);
  const compact = !useMediaQuery('(min-width: 1024px)');
  const { user } = useAuth();

  useEffect(() => setMode(detectSceneMode()), []);

  // Pause the WebGL loop when the hero is off-screen.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setActive(entry!.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = prefersReducedMotion();
    const ctx = gsap.context(() => {
      // Scroll progress drives the 3D object's drift, tilt and recession.
      ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          scroll.current = self.progress;
        },
      });
      if (reduced) return;
      const tl = gsap.timeline({ delay: 0.15 });
      tl.from('[data-hero-line]', { yPercent: 108, duration: 1.25, stagger: 0.09, ease: 'expo.out' })
        .from('[data-hero-fade]', { opacity: 0, y: 18, duration: 1, stagger: 0.08 }, '-=0.85')
        .from('[data-hero-rule]', { scaleX: 0, transformOrigin: 'left center', duration: 1.4, ease: 'expo.inOut' }, '-=1.1');
      gsap.to('[data-hero-copy]', {
        yPercent: -18,
        opacity: 0.15,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true },
      });
    }, el);
    return () => ctx.revert();
  }, []);

  const upcoming = meta?.categories.reduce((s, c) => s + c.upcomingCount, 0);

  return (
    <section ref={root} className="grain relative min-h-[100svh] overflow-hidden bg-ink" aria-labelledby="hero-title">
      {/* soft light pool behind the object — the only gradient, and it's a light source */}
      <div
        className="pointer-events-none absolute -right-[10vw] top-[8vh] h-[80vh] w-[70vw] opacity-60 max-lg:left-0 max-lg:right-0 max-lg:top-0 max-lg:h-[60vh] max-lg:w-full"
        style={{ background: 'radial-gradient(closest-side, rgba(245,243,238,0.07), transparent)' }}
        aria-hidden
      />
      {mode === null ? null : mode === 'fallback' ? (
        <ArmillaryFallback compact={compact} />
      ) : (
        <Suspense fallback={null}>
          <HeroScene mode={mode} scroll={scroll} compact={compact} active={active} />
        </Suspense>
      )}

      <div data-hero-copy className="container-x relative z-10 flex min-h-[100svh] flex-col justify-end pb-10 pt-[calc(var(--nav-h)+2rem)] sm:pb-14">
        <div className="mb-auto hidden pt-10 lg:block">
          <p data-hero-fade className="eyebrow flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-volt" />
            Events, rooms and the people who fill them
          </p>
        </div>

        <h1 id="hero-title" className="font-display text-mega font-medium text-bone max-sm:text-[14.2vw]">
          {LINES.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.04em]">
              <span data-hero-line className="block">
                {i === 2 ? (
                  <>
                    UNEXPECTED<span className="text-volt">.</span>
                  </>
                ) : (
                  line
                )}
              </span>
            </span>
          ))}
        </h1>

        <div data-hero-rule className="mt-8 h-px w-full bg-line-strong" />

        <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:items-end">
          <p data-hero-fade className="max-w-md text-[17px] leading-relaxed text-bone/75 lg:col-span-5">
            Find the gig, the workshop, the summit or the supper club you didn’t know you needed — and if you’re the one hosting it, run the whole
            thing from one place.
          </p>
          <div data-hero-fade className="flex flex-wrap gap-3 lg:col-span-4">
            <ButtonLink to="/events" size="lg" iconRight={<ArrowUpRight className="h-4 w-4" />}>
              Explore Events
            </ButtonLink>
            <ButtonLink
              to={user?.role === 'ORGANIZER' ? '/organizer/events/new' : '/sign-up?role=ORGANIZER'}
              size="lg"
              variant="secondary"
              icon={<Plus className="h-4 w-4" />}
            >
              Create an Event
            </ButtonLink>
          </div>
          <div data-hero-fade className="flex items-end justify-between gap-6 text-[13px] text-mute lg:col-span-3 lg:flex-col lg:items-end lg:text-right">
            {upcoming !== undefined && meta ? (
              <p>
                <span className="tnum font-display text-2xl text-bone">{num(upcoming)}</span> upcoming events
                <br />
                across {meta.cities.length} cities
              </p>
            ) : (
              <span className="h-10" />
            )}
            {next ? (
              <Link to={`/events/${next.slug}`} className="group hidden items-center gap-2 text-bone/80 hover:text-bone sm:flex">
                <span className="text-mute">Next up</span>
                <span className="link-underline max-w-[220px] truncate">{next.title}</span>
                <span className="tnum text-mute">{dayMonth(next.startsAt, next.timezone)}</span>
                <ArrowDownRight className="h-3.5 w-3.5 -rotate-90 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
