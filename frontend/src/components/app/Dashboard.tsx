import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, useInView } from 'framer-motion';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Info } from 'lucide-react';
import type { DayPoint, Revenue } from '@/lib/types';
import { money, num } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Counts up to a value once, when first visible. */
export function AnimatedNumber({ value, format = num, className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setDisplay(v) });
    return () => controls.stop();
  }, [inView, value, reduced]);
  return (
    <span ref={ref} className={cn('tnum', className)}>
      {format(Math.round(display))}
    </span>
  );
}

export function StatCard({
  label,
  value,
  format,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  sub?: ReactNode;
  accent?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col justify-between rounded-md border bg-ink-800 p-5', accent ? 'border-volt/30' : 'border-line')}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-mute">{label}</p>
        {icon ? <span className="text-mute-700">{icon}</span> : null}
      </div>
      <p className={cn('mt-5 font-display text-[2.1rem] font-medium leading-none tracking-[-0.03em]', accent && 'text-volt')}>
        <AnimatedNumber value={value} format={format} />
      </p>
      {sub ? <p className="mt-2 text-[12.5px] text-mute">{sub}</p> : null}
    </div>
  );
}

function shortDay(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, day!)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function ChartTip({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-line-strong bg-ink-800 px-3 py-2 text-[12px] shadow-xl">
      <p className="text-mute">{label ? shortDay(label) : ''}</p>
      <p className="tnum mt-0.5 text-bone">
        {num(payload[0]!.value)} {unit}
      </p>
    </div>
  );
}

/** Single-series daily registrations (tickets issued per IST day). */
export function RegistrationsChart({ data, height = 240 }: { data: DayPoint[]; height?: number }) {
  const reduced = useReducedMotion();
  const total = data.reduce((s, d) => s + d.tickets, 0);
  return (
    <figure>
      <div style={{ height }} role="img" aria-label={`Tickets issued per day over the last ${data.length} days, ${total} in total.`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="regFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C7F36B" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#C7F36B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#232323" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fill: '#7A7A7A', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
            <YAxis allowDecimals={false} tick={{ fill: '#7A7A7A', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip content={<ChartTip unit="tickets" />} cursor={{ stroke: '#3A3A3A', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="tickets"
              stroke="#C7F36B"
              strokeWidth={2}
              fill="url(#regFill)"
              isAnimationActive={!reduced}
              animationDuration={1100}
              activeDot={{ r: 4, fill: '#C7F36B', stroke: '#141414', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Single-series vertical bars, e.g. events created per week. */
export function CountBars({ data, height = 200, unit }: { data: { label: string; value: number }[]; height?: number; unit: string }) {
  const reduced = useReducedMotion();
  return (
    <div style={{ height }} role="img" aria-label={`${unit} by period`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
          <CartesianGrid stroke="#232323" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#7A7A7A', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: '#7A7A7A', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded border border-line-strong bg-ink-800 px-3 py-2 text-[12px] shadow-xl">
                  <p className="text-mute">{label}</p>
                  <p className="tnum mt-0.5">
                    {num(Number(payload[0]!.value))} {unit}
                  </p>
                </div>
              ) : null
            }
          />
          <Bar dataKey="value" fill="#C7F36B" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={!reduced} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal "sold of capacity" meters. One measure, so no legend; values are labelled in text. */
export function InventoryBars({ rows }: { rows: { key: string; label: string; sub?: string; sold: number; quantity: number }[] }) {
  return (
    <ul className="space-y-4">
      {rows.map((r) => {
        const pct = r.quantity ? Math.min(100, (r.sold / r.quantity) * 100) : 0;
        return (
          <li key={r.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-4 text-[13px]">
              <span className="min-w-0 truncate">
                {r.label}
                {r.sub ? <span className="text-mute"> · {r.sub}</span> : null}
              </span>
              <span className="tnum shrink-0 text-mute">
                <span className="text-bone">{num(r.sold)}</span> / {num(r.quantity)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-600" role="meter" aria-valuemin={0} aria-valuemax={r.quantity} aria-valuenow={r.sold} aria-label={`${r.label} sold`}>
              <div className={cn('h-full rounded-full transition-[width] duration-1000 ease-out-expo', pct >= 100 ? 'bg-signal-danger' : 'bg-volt')} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Revenue that refuses to lie: real money and simulated dev-checkout volume are never added together. */
export function RevenueCard({ revenue }: { revenue: Revenue }) {
  const hasReal = revenue.realCents > 0;
  return (
    <div className="flex flex-col justify-between rounded-md border border-line bg-ink-800 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-mute">Revenue</p>
        <span title={revenue.note} className="text-mute-700">
          <Info className="h-4 w-4" />
        </span>
      </div>
      {hasReal ? (
        <p className="mt-5 font-display text-[2.1rem] font-medium leading-none tracking-[-0.03em]">
          <AnimatedNumber value={revenue.realCents} format={(n) => money(n)} />
        </p>
      ) : (
        <p className="mt-5 font-display text-[1.35rem] font-medium leading-tight tracking-[-0.02em] text-bone/70">No live payments</p>
      )}
      <p className="mt-2 text-[12.5px] leading-snug text-mute">
        {revenue.simulatedCents > 0 ? (
          <>
            <span className="tnum text-bone/80">{money(revenue.simulatedCents)}</span> in dev-checkout bookings (simulated, not revenue)
          </>
        ) : (
          'No payment provider connected'
        )}
      </p>
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-md border border-line', className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-[13.5px]">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn('border-b border-line bg-ink-850 px-4 py-3 text-[11.5px] font-medium uppercase tracking-[0.08em] text-mute', className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('border-b border-line px-4 py-3 align-middle', className)}>{children}</td>;
}
