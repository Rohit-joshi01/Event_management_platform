import { useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ScanLine, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { TicketVerification } from '@/lib/types';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { Button } from '@/components/ui/Button';
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/cn';

interface LogItem {
  at: Date;
  code: string;
  ok: boolean;
  text: string;
}

export default function CheckIn() {
  usePageCrumbs([{ label: 'Check-in' }]);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<TicketVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const push = (item: LogItem) => setLog((l) => [item, ...l].slice(0, 12));

  const verify = useMutation({
    mutationFn: (c: string) => api.tickets.verify(c),
    onSuccess: (r) => {
      setResult(r);
      setError(null);
    },
    onError: (e) => {
      setResult(null);
      setError(e instanceof ApiError ? e.message : 'Lookup failed.');
    },
  });

  const checkIn = useMutation({
    mutationFn: (c: string) => api.tickets.checkIn(c),
    onSuccess: (r) => {
      setResult(r);
      setError(null);
      push({ at: new Date(), code: r.code, ok: true, text: `${r.attendeeName} · ${r.ticketTypeName}` });
      setCode('');
      input.current?.focus();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Check-in failed.';
      setError(msg);
      push({ at: new Date(), code, ok: false, text: msg });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (c) verify.mutate(c);
  };

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeader
        title="Check-in"
        description="Scan a ticket’s QR code with a handheld scanner (it types the code into the field) or enter the code manually. Only tickets for your own events can be verified."
      />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <form onSubmit={onSubmit} className="rounded-md border border-line bg-ink-800 p-5">
            <label htmlFor="code" className="text-[13px] font-medium">
              Ticket code
            </label>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
                <input
                  id="code"
                  ref={input}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Scan or paste the code"
                  className="h-12 w-full rounded border border-line bg-ink-850 pl-9 pr-3 font-mono text-[14px] placeholder:font-sans placeholder:text-mute-700 focus:border-volt/60 focus:outline-none focus:ring-2 focus:ring-volt/15"
                />
              </div>
              <Button type="submit" size="lg" loading={verify.isPending} disabled={!code.trim()}>
                Verify
              </Button>
            </div>
          </form>

          <AnimatePresence mode="wait">
            {result || error ? (
              <motion.div
                key={(result?.code ?? '') + (result?.status ?? '') + (error ?? '')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  'mt-4 rounded-md border p-6',
                  error || !result?.valid ? 'border-signal-danger/40 bg-signal-danger/[0.05]' : 'border-volt/40 bg-volt/[0.05]',
                )}
                role="status"
              >
                {error ? (
                  <p className="flex items-center gap-2 text-[#ff9c92]">
                    <XCircle className="h-5 w-5" /> {error}
                  </p>
                ) : result ? (
                  <>
                    <p className={cn('flex items-center gap-2 font-medium', result.valid ? 'text-volt' : 'text-[#ff9c92]')}>
                      {result.valid ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                      {result.message}
                    </p>
                    {result.eventTitle ? (
                      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                        <Item k="Attendee" v={result.attendeeName} />
                        <Item k="Ticket" v={result.ticketTypeName} />
                        <Item k="Event" v={result.eventTitle} />
                        <Item k="Booking" v={result.bookingReference} mono />
                        {result.checkedInAt ? <Item k="Checked in" v={dateTime(result.checkedInAt)} /> : null}
                      </dl>
                    ) : null}
                    {result.valid ? (
                      <Button className="mt-6" size="lg" loading={checkIn.isPending} onClick={() => checkIn.mutate(result.code)}>
                        Check in
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <div className="lg:col-span-5">
          <div className="rounded-md border border-line bg-ink-800">
            <p className="border-b border-line px-5 py-4 text-[15px] font-medium">This session</p>
            {log.length ? (
              <ul className="divide-y divide-line">
                {log.map((l, i) => (
                  <li key={i} className="flex items-start gap-3 px-5 py-3 text-[13px]">
                    {l.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-volt" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal-danger" />}
                    <div className="min-w-0">
                      <p className="truncate">{l.text}</p>
                      <p className="text-[11.5px] text-mute">{l.at.toLocaleTimeString()}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-mute">Check-ins you make here will be listed.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Item({ k, v, mono }: { k: string; v: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[12px] text-mute">{k}</dt>
      <dd className={cn('mt-0.5', mono && 'font-mono text-[13px]')}>{v ?? '—'}</dd>
    </div>
  );
}
