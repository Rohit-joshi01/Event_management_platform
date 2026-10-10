import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, CircleDashed, FileText, QrCode, ShieldCheck, Ticket } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { useAuth } from '@/auth/AuthContext';
import type { EventDetail } from '@/lib/types';
import { gsap, prefersReducedMotion } from '@/lib/gsap';
import { money, num, shortDate } from '@/lib/format';
import { cn } from '@/lib/cn';

const STEPS = [
  {
    icon: FileText,
    title: 'Draft it in minutes',
    body: 'A four-step editor for the basics, the when and where, ticket tiers and a final review. Save a draft at any point.',
  },
  {
    icon: ShieldCheck,
    title: 'Reviewed by real people',
    body: 'Submissions go to the AFTR team. You get a decision — and if something’s missing, a clear note on what to fix.',
  },
  {
    icon: Ticket,
    title: 'Sell without overselling',
    body: 'Every seat is reserved atomically on the server, so two people can never buy the last ticket. Sold-out happens on time.',
  },
  {
    icon: QrCode,
    title: 'Check people in at the door',
    body: 'Each ticket carries an unguessable QR code. Scan or type it in; duplicates and cancelled tickets are refused.',
  },
];

/**
 * Organizer pitch in a deliberately different rhythm: a light surface, numbered steps and a sticky
 * product preview that changes state as each step scrolls past. The preview is rendered from a real
 * published event's ticket inventory.
 */
export function OrganizerSection({ sample }: { sample?: EventDetail }) {
  const root = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>('[data-step]');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) setStep(Number((en.target as HTMLElement).dataset.step));
        });
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-org-title] > span > span', { yPercent: 110, stagger: 0.08, duration: 1.2, scrollTrigger: { trigger: el, start: 'top 70%' } });
    }, el);
    return () => ctx.revert();
  }, []);

  const cta = user?.role === 'ORGANIZER' ? '/organizer/events/new' : '/sign-up?role=ORGANIZER';

  return (
    <section ref={root} id="organizers" className="bg-bone text-ink" aria-labelledby="org-title">
      <div className="container-x py-24 lg:py-36">
        <div className="grid gap-6 lg:grid-cols-12">
          <p className="eyebrow !text-ink/50 lg:col-span-2">(05) — For organizers</p>
          <h2 id="org-title" data-org-title className="font-display text-giant font-medium lg:col-span-10">
            <span className="block overflow-hidden">
              <span className="block">Your idea,</span>
            </span>
            <span className="block overflow-hidden">
              <span className="block">
                run <span className="font-serif font-normal italic tracking-normal">properly.</span>
              </span>
            </span>
          </h2>
        </div>

        <div className="mt-16 grid gap-12 lg:mt-24 lg:grid-cols-12">
          <ol className="lg:col-span-5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={s.title} data-step={i} className={cn('border-t border-ink/15 py-10 transition-opacity duration-500 lg:min-h-[52vh] lg:py-14', step === i ? 'opacity-100' : 'lg:opacity-35')}>
                  <div className="flex items-center gap-4">
                    <span className="tnum font-display text-sm text-ink/45">0{i + 1}</span>
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-6 font-display text-[clamp(1.6rem,2.6vw,2.4rem)] font-medium leading-[1.05] tracking-[-0.035em]">{s.title}</h3>
                  <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-ink/65">{s.body}</p>
                  <div className="mt-8 lg:hidden">
                    <Preview step={i} sample={sample} />
                  </div>
                </li>
              );
            })}
            <li className="border-t border-ink/15 pt-10">
              <div className="flex flex-wrap gap-3">
                <ButtonLink to={cta} size="lg" variant="light" iconRight={<ArrowRight className="h-4 w-4" />}>
                  Start organizing
                </ButtonLink>
                <ButtonLink to="/organizers" size="lg" variant="outline-light">
                  How it works
                </ButtonLink>
              </div>
            </li>
          </ol>
          <div className="hidden lg:col-span-6 lg:col-start-7 lg:block">
            <div className="sticky top-[calc(var(--nav-h)+4vh)]">
              <Preview step={step} sample={sample} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Preview({ step, sample }: { step: number; sample?: EventDetail }) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink/10 bg-ink text-bone shadow-[0_50px_100px_-30px_rgba(10,10,10,0.55)]">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-ink-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-500" />
        </div>
        <p className="text-[11.5px] text-mute">aftr / organizer / {['new event', 'review', 'tickets', 'check-in'][step]}</p>
        <span className="w-10" />
      </div>
      <div className="relative min-h-[420px] p-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
            {step === 0 ? <DraftPreview sample={sample} /> : null}
            {step === 1 ? <ReviewPreview sample={sample} /> : null}
            {step === 2 ? <InventoryPreview sample={sample} /> : null}
            {step === 3 ? <CheckinPreview sample={sample} /> : null}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="border-t border-line px-5 py-3 text-[11px] text-mute-700">
        {sample ? `Preview built from the live listing “${sample.title}”.` : 'Preview of the organizer workspace.'}
      </p>
    </div>
  );
}

function DraftPreview({ sample }: { sample?: EventDetail }) {
  const steps = ['Basics', 'When & where', 'Tickets', 'Review'];
  return (
    <div>
      <div className="mb-6 flex gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={cn('h-0.5 rounded-full', i === 0 ? 'bg-volt' : 'bg-ink-500')} />
            <p className={cn('mt-2 text-[11px]', i === 0 ? 'text-bone' : 'text-mute-700')}>{s}</p>
          </div>
        ))}
      </div>
      <FakeField label="Title" value={sample?.title ?? 'Your event title'} />
      <FakeField label="Category" value={sample?.category.name ?? 'Technology'} />
      <FakeField label="Summary" value={sample?.summary ?? 'One line that makes someone want to come.'} multiline />
      <div className="mt-6 flex justify-end gap-2">
        <span className="rounded border border-line-strong px-3 py-1.5 text-[12px] text-bone/80">Save draft</span>
        <span className="rounded bg-volt px-3 py-1.5 text-[12px] font-medium text-ink">Continue</span>
      </div>
    </div>
  );
}

function FakeField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-[11.5px] text-mute">{label}</p>
      <div className={cn('rounded border border-line bg-ink-850 px-3 text-[13px] text-bone/90', multiline ? 'py-2.5 leading-relaxed' : 'flex h-9 items-center')}>{value}</div>
    </div>
  );
}

function ReviewPreview({ sample }: { sample?: EventDetail }) {
  const rows: [string, string, boolean][] = [
    ['Draft', sample ? shortDate(sample.createdAt) : '—', true],
    ['Submitted for review', sample?.submittedAt ? shortDate(sample.submittedAt) : '—', true],
    ['Approved and live', sample?.publishedAt ? shortDate(sample.publishedAt) : '—', true],
  ];
  return (
    <div>
      <p className="eyebrow mb-5">Status history</p>
      <ol className="space-y-0">
        {rows.map(([label, date, done], i) => (
          <motion.li key={label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.18 }} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-full border', done ? 'border-volt bg-volt text-ink' : 'border-line-strong text-mute')}>
                {done ? <Check className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
              </span>
              {i < rows.length - 1 ? <span className="h-12 w-px bg-line-strong" /> : null}
            </div>
            <div className="pt-1">
              <p className="text-[14px]">{label}</p>
              <p className="tnum text-[12px] text-mute">{date}</p>
            </div>
          </motion.li>
        ))}
      </ol>
      <div className="mt-6 rounded border border-line bg-ink-850 p-4 text-[12.5px] leading-relaxed text-mute">
        Rejections always come with a written reason, recorded in the audit log and sent to the organizer.
      </div>
    </div>
  );
}

function InventoryPreview({ sample }: { sample?: EventDetail }) {
  const types = sample?.ticketTypes ?? [];
  const sold = types.reduce((s, t) => s + t.sold, 0);
  const cap = types.reduce((s, t) => s + t.quantity, 0);
  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1">Tickets sold</p>
          <p className="tnum font-display text-4xl font-medium tracking-tight">
            {num(sold)}
            <span className="text-lg text-mute"> / {num(cap)}</span>
          </p>
        </div>
        <p className="tnum text-[13px] text-volt">{cap ? Math.round((sold / cap) * 100) : 0}% capacity</p>
      </div>
      <ul className="space-y-5">
        {types.map((t, i) => {
          const pct = t.quantity ? (t.sold / t.quantity) * 100 : 0;
          return (
            <li key={t.id}>
              <div className="mb-2 flex justify-between text-[13px]">
                <span>
                  {t.name} <span className="text-mute">· {t.priceCents ? money(t.priceCents) : 'Free'}</span>
                </span>
                <span className="tnum text-mute">
                  {t.remaining === 0 ? <span className="text-[#ff9c92]">Sold out</span> : `${num(t.remaining)} left`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink-600">
                <motion.div className="h-full rounded-full bg-volt" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.1, delay: 0.1 + i * 0.12, ease: [0.16, 1, 0.3, 1] }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CheckinPreview({ sample }: { sample?: EventDetail }) {
  return (
    <div className="grid gap-6 sm:grid-cols-[150px_1fr]">
      <div className="flex aspect-square items-center justify-center rounded border border-line bg-bone p-4">
        <QrGlyph />
      </div>
      <div>
        <p className="eyebrow mb-2">Verify ticket</p>
        <div className="flex h-10 items-center rounded border border-line bg-ink-850 px-3 font-mono text-[12px] text-mute">x7Kp…Q2vA</div>
        <div className="mt-4 rounded border border-volt/30 bg-volt/[0.06] p-4">
          <p className="flex items-center gap-2 text-[14px] text-volt">
            <Check className="h-4 w-4" /> Valid — ready to check in
          </p>
          <p className="mt-1 text-[12.5px] text-mute">{sample ? `${sample.ticketTypes[0]?.name ?? 'General'} · ${sample.title}` : 'General admission'}</p>
        </div>
        <p className="mt-4 text-[12.5px] leading-relaxed text-mute">A second scan of the same code is refused with the time it was first used.</p>
      </div>
    </div>
  );
}

function QrGlyph() {
  // Decorative QR-like glyph (not a scannable code).
  const cells = Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21;
    const y = Math.floor(i / 21);
    const finder = (cx: number, cy: number) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7 && (x === cx || x === cx + 6 || y === cy || y === cy + 6 || (x >= cx + 2 && x <= cx + 4 && y >= cy + 2 && y <= cy + 4));
    if (finder(0, 0) || finder(14, 0) || finder(0, 14)) return true;
    if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) return false;
    return ((x * 7 + y * 13 + x * y) % 5) < 2;
  });
  return (
    <svg viewBox="0 0 21 21" className="h-full w-full" aria-hidden shapeRendering="crispEdges">
      {cells.map((on, i) => (on ? <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#0A0A0A" /> : null))}
    </svg>
  );
}
