const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrPrecise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('en-IN');

export function money(paise: number, precise = false) {
  const rupees = paise / 100;
  if (!precise && Number.isInteger(rupees)) return inr.format(rupees);
  return inrPrecise.format(rupees);
}

export function priceLabel(minPaise: number) {
  return minPaise === 0 ? 'Free' : `From ${money(minPaise)}`;
}

export const num = (n: number) => integer.format(n);
export const compactNum = (n: number) => compact.format(n);

function fmt(iso: string, tz: string | undefined, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, ...opts }).format(new Date(iso));
}

export const dayMonth = (iso: string, tz?: string) => fmt(iso, tz, { day: 'numeric', month: 'short' });
export const weekday = (iso: string, tz?: string) => fmt(iso, tz, { weekday: 'short' });
export const fullDate = (iso: string, tz?: string) => fmt(iso, tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const shortDate = (iso: string, tz?: string) => fmt(iso, tz, { day: 'numeric', month: 'short', year: 'numeric' });
export const time = (iso: string, tz?: string) => fmt(iso, tz, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', ' ').toUpperCase();
export const dateTime = (iso: string, tz?: string) => `${shortDate(iso, tz)}, ${time(iso, tz)}`;

export function monthAbbr(iso: string, tz?: string) {
  return fmt(iso, tz, { month: 'short' }).toUpperCase();
}

export function dayNum(iso: string, tz?: string) {
  return fmt(iso, tz, { day: '2-digit' });
}

export function tzLabel(tz: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
  } catch {
    return tz;
  }
}

export function relative(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536e6],
    ['month', 2592e6],
    ['week', 6048e5],
    ['day', 864e5],
    ['hour', 36e5],
    ['minute', 6e4],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}

export function eventWhen(startsAt: string, endsAt: string, tz: string) {
  const sameDay = shortDate(startsAt, tz) === shortDate(endsAt, tz);
  if (sameDay) return `${fullDate(startsAt, tz)} · ${time(startsAt, tz)} – ${time(endsAt, tz)}`;
  return `${dateTime(startsAt, tz)} – ${dateTime(endsAt, tz)}`;
}

export function where(e: { format: string; venueName: string | null; city: string | null }) {
  if (e.format === 'ONLINE') return 'Online';
  return [e.venueName, e.city].filter(Boolean).join(', ') || 'Venue to be announced';
}

export function humanize(code: string) {
  return code.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
