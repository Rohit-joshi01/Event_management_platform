/** Time-zone helpers for datetime-local inputs: the organizer enters wall-clock time in the event's zone. */

function offsetMs(instant: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - instant;
}

/** "2026-10-20T18:30" in tz → ISO instant string (UTC). */
export function zonedInputToIso(local: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const wall = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  let guess = wall - offsetMs(wall, tz);
  guess = wall - offsetMs(guess, tz);
  return new Date(guess).toISOString();
}

/** ISO instant → "YYYY-MM-DDTHH:mm" wall-clock in tz, for datetime-local inputs. */
export function isoToZonedInput(iso: string | null | undefined, tz: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const local = new Date(t + offsetMs(t, tz));
  return local.toISOString().slice(0, 16);
}

export const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
];
