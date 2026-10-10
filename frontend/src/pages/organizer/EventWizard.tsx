import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, ImagePlus, Plus, Save, Send, Trash2, Upload } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { EventDetail, EventFormat, EventUpsert, TicketTypeUpsert } from '@/lib/types';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Tabs';
import { Cover } from '@/components/ui/Media';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { isoToZonedInput, TIMEZONES, zonedInputToIso } from '@/lib/tz';
import { eventWhen, money } from '@/lib/format';
import { cn } from '@/lib/cn';

interface TicketDraft {
  key: string;
  id?: number;
  name: string;
  description: string;
  price: string; // rupees
  quantity: string;
  salesStart: string; // datetime-local in event tz
  salesEnd: string;
  maxPerOrder: string;
  sold: number;
}

interface ScheduleDraft {
  key: string;
  at: string; // datetime-local
  title: string;
  description: string;
}

interface Draft {
  title: string;
  summary: string;
  description: string;
  categorySlug: string;
  coverImageUrl: string;
  timezone: string;
  starts: string;
  ends: string;
  format: EventFormat;
  venueName: string;
  venueAddress: string;
  city: string;
  onlineUrl: string;
  schedule: ScheduleDraft[];
  tickets: TicketDraft[];
}

const STEPS = ['Basics', 'Date & venue', 'Tickets', 'Review'] as const;
let keySeq = 0;
const k = () => `k${++keySeq}`;

const emptyTicket = (): TicketDraft => ({ key: k(), name: 'General admission', description: '', price: '0', quantity: '100', salesStart: '', salesEnd: '', maxPerOrder: '4', sold: 0 });

function fromEvent(e: EventDetail): Draft {
  const tz = e.timezone;
  return {
    title: e.title,
    summary: e.summary,
    description: e.description,
    categorySlug: e.category.slug,
    coverImageUrl: e.coverImageUrl ?? '',
    timezone: tz,
    starts: isoToZonedInput(e.startsAt, tz),
    ends: isoToZonedInput(e.endsAt, tz),
    format: e.format,
    venueName: e.venue?.name ?? '',
    venueAddress: e.venue?.address ?? '',
    city: e.venue?.city ?? '',
    onlineUrl: e.onlineUrl ?? '',
    schedule: e.schedule.map((s) => ({ key: k(), at: isoToZonedInput(s.startsAt, tz), title: s.title, description: s.description ?? '' })),
    tickets: e.ticketTypes.map((t) => ({
      key: k(),
      id: t.id,
      name: t.name,
      description: t.description ?? '',
      price: String(t.priceCents / 100),
      quantity: String(t.quantity),
      salesStart: isoToZonedInput(t.salesStart, tz),
      salesEnd: isoToZonedInput(t.salesEnd, tz),
      maxPerOrder: String(t.maxPerOrder),
      sold: t.sold,
    })),
  };
}

function blankDraft(): Draft {
  const start = new Date();
  start.setDate(start.getDate() + 14);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start);
  end.setHours(21);
  const tz = 'Asia/Kolkata';
  return {
    title: '',
    summary: '',
    description: '',
    categorySlug: '',
    coverImageUrl: '',
    timezone: tz,
    starts: isoToZonedInput(start.toISOString(), tz),
    ends: isoToZonedInput(end.toISOString(), tz),
    format: 'IN_PERSON',
    venueName: '',
    venueAddress: '',
    city: '',
    onlineUrl: '',
    schedule: [],
    tickets: [emptyTicket()],
  };
}

type Errors = Record<string, string>;

function validateStep(step: number, d: Draft): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (d.title.trim().length < 4) e.title = 'Give your event a title (at least 4 characters).';
    if (d.summary.trim().length < 10) e.summary = 'Add a one-line summary (at least 10 characters).';
    if (d.description.trim().length < 20) e.description = 'Describe your event (at least 20 characters).';
    if (!d.categorySlug) e.categorySlug = 'Choose a category.';
    if (d.coverImageUrl && !/^(\/uploads\/|https:\/\/)/.test(d.coverImageUrl)) e.coverImageUrl = 'Upload an image or paste an https:// link.';
  }
  if (step === 1) {
    const s = zonedInputToIso(d.starts, d.timezone);
    const en = zonedInputToIso(d.ends, d.timezone);
    if (!s) e.startsAt = 'Set a start time.';
    else if (new Date(s).getTime() <= Date.now()) e.startsAt = 'The event must start in the future.';
    if (!en) e.endsAt = 'Set an end time.';
    else if (s && new Date(en) <= new Date(s)) e.endsAt = 'The event must end after it starts.';
    if (d.format !== 'ONLINE') {
      if (!d.venueName.trim()) e.venueName = 'Add the venue name.';
      if (!d.city.trim()) e.city = 'Add the city.';
    }
    if (d.format !== 'IN_PERSON' && !/^https:\/\//.test(d.onlineUrl.trim())) e.onlineUrl = 'Add the https:// link attendees will use to join.';
    d.schedule.forEach((it, i) => {
      if (!it.title.trim()) e[`schedule.${i}.title`] = 'Add a title.';
      if (!it.at) e[`schedule.${i}.at`] = 'Set a time.';
    });
  }
  if (step === 2) {
    if (!d.tickets.length) e.tickets = 'Add at least one ticket type.';
    d.tickets.forEach((t, i) => {
      const price = Number(t.price);
      const qty = Number(t.quantity);
      const max = Number(t.maxPerOrder);
      if (!t.name.trim()) e[`t.${i}.name`] = 'Name this ticket.';
      if (!Number.isFinite(price) || price < 0) e[`t.${i}.price`] = 'Enter a price of 0 or more.';
      if (!Number.isInteger(qty) || qty < 1) e[`t.${i}.quantity`] = 'Quantity must be a whole number ≥ 1.';
      else if (qty < t.sold) e[`t.${i}.quantity`] = `${t.sold} already sold — can’t go lower.`;
      if (!Number.isInteger(max) || max < 1 || max > 10) e[`t.${i}.maxPerOrder`] = 'Between 1 and 10.';
      const ss = t.salesStart ? zonedInputToIso(t.salesStart, d.timezone) : null;
      const se = t.salesEnd ? zonedInputToIso(t.salesEnd, d.timezone) : null;
      const end = zonedInputToIso(d.ends, d.timezone);
      if (ss && se && new Date(se) <= new Date(ss)) e[`t.${i}.salesEnd`] = 'Sales must end after they start.';
      if (se && end && new Date(se) > new Date(end)) e[`t.${i}.salesEnd`] = 'Sales must end before the event ends.';
    });
  }
  return e;
}

function toUpsert(d: Draft): EventUpsert {
  return {
    title: d.title.trim(),
    summary: d.summary.trim(),
    description: d.description.trim(),
    categorySlug: d.categorySlug,
    coverImageUrl: d.coverImageUrl.trim(),
    startsAt: zonedInputToIso(d.starts, d.timezone)!,
    endsAt: zonedInputToIso(d.ends, d.timezone)!,
    timezone: d.timezone,
    format: d.format,
    venueName: d.format === 'ONLINE' ? '' : d.venueName.trim(),
    venueAddress: d.format === 'ONLINE' ? '' : d.venueAddress.trim(),
    city: d.format === 'ONLINE' ? '' : d.city.trim(),
    onlineUrl: d.format === 'IN_PERSON' ? '' : d.onlineUrl.trim(),
    schedule: d.schedule.map((s) => ({ startsAt: zonedInputToIso(s.at, d.timezone)!, title: s.title.trim(), description: s.description.trim() })),
  };
}

function toTicket(t: TicketDraft, tz: string, i: number): TicketTypeUpsert {
  return {
    name: t.name.trim(),
    description: t.description.trim(),
    priceCents: Math.round(Number(t.price) * 100),
    quantity: Number(t.quantity),
    salesStart: t.salesStart ? zonedInputToIso(t.salesStart, tz) : null,
    salesEnd: t.salesEnd ? zonedInputToIso(t.salesEnd, tz) : null,
    maxPerOrder: Number(t.maxPerOrder),
    sortOrder: i,
  };
}

const FIELD_STEP: Record<string, number> = {
  title: 0, summary: 0, description: 0, categorySlug: 0, coverImageUrl: 0,
  startsAt: 1, endsAt: 1, timezone: 1, format: 1, venueName: 1, venueAddress: 1, city: 1, onlineUrl: 1,
};

export default function EventWizard() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(editId ? null : blankDraft());
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<number | null>(editId);
  const removed = useRef<number[]>([]);
  const baseline = useRef<string>('');

  const categories = useQuery({ queryKey: ['categories'], queryFn: api.events.categories });
  const existing = useQuery({ queryKey: ['events', 'detail', String(editId)], queryFn: () => api.events.detail(editId!), enabled: !!editId });

  useEffect(() => {
    if (existing.data && !draft) {
      const d = fromEvent(existing.data);
      setDraft(d);
      baseline.current = JSON.stringify(d.tickets);
    }
  }, [existing.data, draft]);

  const status = existing.data?.status;
  usePageCrumbs(
    editId ? [{ label: 'Events', to: '/organizer/events' }, { label: existing.data?.title ?? 'Event', to: `/organizer/events/${editId}` }, { label: 'Edit' }] : [{ label: 'Events', to: '/organizer/events' }, { label: 'Create event' }],
  );

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setErrors((e) => {
      const n = { ...e };
      delete n[key as string];
      return n;
    });
  };

  const persist = useMutation({
    mutationFn: async (d: Draft) => {
      const body = toUpsert(d);
      const saved = eventId ? await api.events.update(eventId, body) : await api.events.create(body);
      const evId = saved.id;
      setEventId(evId);
      for (const tid of removed.current) await api.events.deleteTicket(evId, tid);
      removed.current = [];
      const original = baseline.current ? (JSON.parse(baseline.current) as TicketDraft[]) : [];
      const nextTickets: TicketDraft[] = [];
      for (let i = 0; i < d.tickets.length; i++) {
        const t = d.tickets[i]!;
        if (!t.id) {
          const created = await api.events.createTicket(evId, toTicket(t, d.timezone, i));
          nextTickets.push({ ...t, id: created.id });
        } else {
          const before = original.find((o) => o.id === t.id);
          if (!before || JSON.stringify({ ...before, key: '' }) !== JSON.stringify({ ...t, key: '' })) {
            await api.events.updateTicket(evId, t.id, toTicket(t, d.timezone, i));
          }
          nextTickets.push(t);
        }
      }
      const fresh = { ...d, tickets: nextTickets };
      setDraft(fresh);
      baseline.current = JSON.stringify(nextTickets);
      return evId;
    },
  });

  const submit = useMutation({ mutationFn: (evId: number) => api.events.submit(evId) });

  const handleError = (err: unknown) => {
    if (err instanceof ApiError) {
      const map = err.fieldMap();
      const mapped: Errors = {};
      let target: number | null = null;
      for (const [f, m] of Object.entries(map)) {
        const key = f === 'eventUpsertRequest' ? 'endsAt' : f.startsWith('schedule[') ? f.replace(/schedule\[(\d+)\]\.startsAt/, 'schedule.$1.at').replace(/schedule\[(\d+)\]\./, 'schedule.$1.') : f;
        mapped[key] = m;
        const s = FIELD_STEP[key] ?? (key.startsWith('schedule') ? 1 : null);
        if (s !== null && s !== undefined) target = target === null ? s : Math.min(target, s);
      }
      if (err.code === 'START_IN_PAST') {
        mapped.startsAt = err.message;
        target = 1;
      }
      if (['QUANTITY_BELOW_SOLD', 'PRICE_LOCKED', 'SALES_AFTER_EVENT', 'TOO_MANY_TICKET_TYPES', 'HAS_SALES', 'LAST_TICKET_TYPE'].includes(err.code)) target = 2;
      if (['SCHEDULE_OUT_OF_RANGE', 'INVALID_TIMEZONE', 'TOO_LONG'].includes(err.code)) target = 1;
      if (err.code === 'UNKNOWN_CATEGORY') target = 0;
      setErrors(mapped);
      setFormError(err.message);
      if (target !== null) setStep(target);
    } else {
      setFormError('Something went wrong while saving.');
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    for (let s = 0; s <= 2; s++) {
      const v = validateStep(s, draft);
      if (Object.keys(v).length) {
        setErrors(v);
        setStep(s);
        setFormError('Fix the highlighted fields before saving.');
        return;
      }
    }
    setFormError(null);
    try {
      const evId = await persist.mutateAsync(draft);
      void qc.invalidateQueries({ queryKey: ['organizer'] });
      void qc.invalidateQueries({ queryKey: ['events'] });
      toast.success(status === 'PUBLISHED' ? 'Changes saved' : 'Draft saved');
      if (!editId) navigate(`/organizer/events/${evId}/edit`, { replace: true });
      return evId;
    } catch (err) {
      handleError(err);
    }
  };

  const saveAndSubmit = async () => {
    const evId = await saveDraft();
    if (!evId) return;
    try {
      const res = await submit.mutateAsync(evId);
      void qc.invalidateQueries({ queryKey: ['organizer'] });
      void qc.invalidateQueries({ queryKey: ['events'] });
      toast.success(res.status === 'PUBLISHED' ? 'Your event is live' : 'Submitted for review', res.status === 'PENDING' ? 'You’ll get a notification when an administrator decides.' : undefined);
      navigate(`/organizer/events/${evId}`);
    } catch (err) {
      handleError(err);
    }
  };

  const next = () => {
    if (!draft) return;
    const v = validateStep(step, draft);
    setErrors(v);
    if (Object.keys(v).length) return;
    setFormError(null);
    setStep((s) => Math.min(3, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (editId && existing.isError) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />;
  if (!draft) return <Skeleton className="mx-auto h-[600px] max-w-[1100px]" />;

  const locked = status === 'PENDING' || status === 'CANCELLED' || (existing.data && new Date(existing.data.endsAt) < new Date());
  const canSubmit = !status || status === 'DRAFT' || status === 'REJECTED';
  const busy = persist.isPending || submit.isPending;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow={editId ? 'Edit event' : 'New event'}
        title={draft.title || 'Untitled event'}
        description={status ? undefined : 'Work through the four steps. You can save a draft at any time.'}
        actions={status ? <StatusBadge status={status} /> : undefined}
      />

      {existing.data?.status === 'REJECTED' && existing.data.rejectionReason ? (
        <div className="mb-6 rounded border border-signal-danger/30 bg-signal-danger/[0.06] p-4 text-sm">
          <p className="font-medium text-[#ff9c92]">Changes requested by the review team</p>
          <p className="mt-1 text-bone/80">{existing.data.rejectionReason}</p>
        </div>
      ) : null}
      {locked ? (
        <div className="mb-6 rounded border border-signal-warn/30 bg-signal-warn/[0.06] p-4 text-sm">
          {status === 'PENDING'
            ? 'This event is under review and can’t be edited. Withdraw the submission from the event page to make changes.'
            : 'This event can no longer be edited.'}{' '}
          <Link to={`/organizer/events/${editId}`} className="underline">
            Back to event
          </Link>
        </div>
      ) : null}

      {/* Stepper */}
      <ol className="mb-10 grid grid-cols-4 gap-2" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => (i < step ? setStep(i) : undefined)}
              disabled={i > step}
              className="group w-full text-left disabled:cursor-default"
              aria-current={i === step ? 'step' : undefined}
            >
              <div className="h-[3px] overflow-hidden rounded-full bg-ink-600">
                <motion.div className="h-full bg-volt" initial={false} animate={{ width: i <= step ? '100%' : '0%' }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
              </div>
              <p className={cn('mt-2.5 flex items-center gap-1.5 text-[12.5px]', i === step ? 'text-bone' : i < step ? 'text-bone/70 group-hover:text-bone' : 'text-mute-700')}>
                {i < step ? <Check className="h-3.5 w-3.5 text-volt" /> : <span className="tnum">{i + 1}.</span>}
                <span className="hidden sm:inline">{label}</span>
              </p>
            </button>
          </li>
        ))}
      </ol>

      {formError ? (
        <div role="alert" className="mb-6 rounded border border-signal-danger/40 bg-signal-danger/[0.07] px-4 py-3 text-sm text-[#ffb3ab]">
          {formError}
        </div>
      ) : null}

      <fieldset disabled={!!locked || busy} className="min-w-0">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            {step === 0 ? <BasicsStep draft={draft} errors={errors} update={update} categories={categories.data ?? []} /> : null}
            {step === 1 ? <WhenWhereStep draft={draft} errors={errors} update={update} /> : null}
            {step === 2 ? <TicketsStep draft={draft} errors={errors} update={update} onRemove={(tid) => removed.current.push(tid)} /> : null}
            {step === 3 ? <ReviewStep draft={draft} categoryName={categories.data?.find((c) => c.slug === draft.categorySlug)?.name ?? ''} /> : null}
          </motion.div>
        </AnimatePresence>
      </fieldset>

      <div className="sticky bottom-0 z-20 -mx-4 mt-10 flex items-center justify-between gap-3 border-t border-line bg-ink/90 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>
          Back
        </Button>
        <div className="flex gap-2">
          {!locked ? (
            <Button variant="secondary" icon={<Save className="h-4 w-4" />} onClick={saveDraft} loading={persist.isPending && !submit.isPending} disabled={busy}>
              {status === 'PUBLISHED' ? 'Save changes' : 'Save draft'}
            </Button>
          ) : null}
          {step < 3 ? (
            <Button iconRight={<ArrowRight className="h-4 w-4" />} onClick={next} disabled={busy}>
              Continue
            </Button>
          ) : canSubmit && !locked ? (
            <Button icon={<Send className="h-4 w-4" />} onClick={saveAndSubmit} loading={submit.isPending} disabled={busy}>
              Submit for review
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- steps

interface StepProps {
  draft: Draft;
  errors: Errors;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-line py-8 first:pt-0 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <h2 className="font-display text-lg font-medium tracking-tight">{title}</h2>
        {hint ? <p className="mt-1 text-[13.5px] leading-relaxed text-mute">{hint}</p> : null}
      </div>
      <div className="space-y-5 lg:col-span-8">{children}</div>
    </section>
  );
}

function BasicsStep({ draft, errors, update, categories }: StepProps & { categories: { slug: string; name: string }[] }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (f: File) => api.uploads.image(f),
    onSuccess: (r) => update('coverImageUrl', r.url),
    onError: (e) => toast.error('Upload failed', e instanceof ApiError ? e.message : undefined),
  });
  return (
    <div>
      <Section title="The essentials" hint="This is what people see first in listings and search.">
        <Input label="Title" required maxLength={140} value={draft.title} onChange={(e) => update('title', e.target.value)} error={errors.title} />
        <Input label="Summary" required maxLength={280} value={draft.summary} onChange={(e) => update('summary', e.target.value)} error={errors.summary} hint={`One sentence. ${draft.summary.length}/280`} />
        <Select label="Category" required value={draft.categorySlug} onChange={(e) => update('categorySlug', e.target.value)} error={errors.categorySlug}>
          <option value="">Choose a category</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
        <Textarea
          label="Description"
          required
          rows={9}
          value={draft.description}
          onChange={(e) => update('description', e.target.value)}
          error={errors.description}
          hint="Separate paragraphs with a blank line. At least 80 characters are needed to submit for review."
        />
      </Section>
      <Section title="Cover image" hint="A wide photo works best (16:9 or 4:3). JPEG, PNG or WebP up to 5 MB.">
        <div className="overflow-hidden rounded-md border border-line">
          {draft.coverImageUrl ? (
            <Cover src={draft.coverImageUrl} alt="Cover preview" category={draft.categorySlug} className="aspect-[16/9]" />
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 bg-ink-850 text-mute hover:text-bone">
              <ImagePlus className="h-6 w-6" />
              <span className="text-sm">Upload a cover image</span>
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" icon={<Upload className="h-4 w-4" />} loading={upload.isPending} onClick={() => fileRef.current?.click()}>
            {draft.coverImageUrl ? 'Replace image' : 'Upload image'}
          </Button>
          {draft.coverImageUrl ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => update('coverImageUrl', '')}>
              Remove
            </Button>
          ) : null}
        </div>
        <Input label="…or paste an image link" optional placeholder="https://" value={draft.coverImageUrl.startsWith('/uploads/') ? '' : draft.coverImageUrl} onChange={(e) => update('coverImageUrl', e.target.value)} error={errors.coverImageUrl} />
      </Section>
    </div>
  );
}

function WhenWhereStep({ draft, errors, update }: StepProps) {
  return (
    <div>
      <Section title="Date and time" hint="Times are entered in the event’s own time zone and shown to attendees in it.">
        <Select label="Time zone" value={draft.timezone} onChange={(e) => update('timezone', e.target.value)} error={errors.timezone}>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace('_', ' ')}
            </option>
          ))}
        </Select>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Starts" type="datetime-local" required value={draft.starts} onChange={(e) => update('starts', e.target.value)} error={errors.startsAt} />
          <Input label="Ends" type="datetime-local" required value={draft.ends} onChange={(e) => update('ends', e.target.value)} error={errors.endsAt} />
        </div>
      </Section>
      <Section title="Location" hint="In-person events need a venue; online events need a joining link that only registered attendees will see.">
        <Segmented
          label="Format"
          value={draft.format}
          onChange={(v) => update('format', v)}
          items={[
            { value: 'IN_PERSON', label: 'In person' },
            { value: 'ONLINE', label: 'Online' },
            { value: 'HYBRID', label: 'Hybrid' },
          ]}
        />
        {draft.format !== 'ONLINE' ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Venue name" required value={draft.venueName} onChange={(e) => update('venueName', e.target.value)} error={errors.venueName} />
            <Input label="City" required value={draft.city} onChange={(e) => update('city', e.target.value)} error={errors.city} />
            <Input label="Address" optional wrapperClassName="sm:col-span-2" value={draft.venueAddress} onChange={(e) => update('venueAddress', e.target.value)} error={errors.venueAddress} />
          </div>
        ) : null}
        {draft.format !== 'IN_PERSON' ? <Input label="Online link" required placeholder="https://" value={draft.onlineUrl} onChange={(e) => update('onlineUrl', e.target.value)} error={errors.onlineUrl} /> : null}
      </Section>
      <Section title="Schedule" hint="Optional running order shown on the event page.">
        {draft.schedule.map((s, i) => (
          <div key={s.key} className="grid gap-3 rounded-md border border-line p-4 sm:grid-cols-[200px_1fr_auto]">
            <Input
              label="Time"
              type="datetime-local"
              value={s.at}
              onChange={(e) => update('schedule', draft.schedule.map((x) => (x.key === s.key ? { ...x, at: e.target.value } : x)))}
              error={errors[`schedule.${i}.at`]}
            />
            <Input
              label="Title"
              value={s.title}
              onChange={(e) => update('schedule', draft.schedule.map((x) => (x.key === s.key ? { ...x, title: e.target.value } : x)))}
              error={errors[`schedule.${i}.title`]}
            />
            <button type="button" onClick={() => update('schedule', draft.schedule.filter((x) => x.key !== s.key))} className="self-end rounded p-3 text-mute hover:bg-white/5 hover:text-bone" aria-label="Remove schedule item">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => update('schedule', [...draft.schedule, { key: k(), at: draft.starts, title: '', description: '' }])}>
          Add schedule item
        </Button>
      </Section>
    </div>
  );
}

function TicketsStep({ draft, errors, update, onRemove }: StepProps & { onRemove: (id: number) => void }) {
  const set = (key: string, patch: Partial<TicketDraft>) => update('tickets', draft.tickets.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  return (
    <div>
      <Section title="Ticket types" hint="Set a price of 0 for free tickets. Quantities are enforced on the server — tickets can’t oversell. Prices lock once a ticket type has sales.">
        {errors.tickets ? <p className="text-sm text-[#ff9c92]">{errors.tickets}</p> : null}
        {draft.tickets.map((t, i) => (
          <div key={t.key} className="rounded-md border border-line bg-ink-800 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="eyebrow">Ticket {i + 1}</p>
              <div className="flex items-center gap-3">
                {t.sold ? <span className="tnum text-[12px] text-mute">{t.sold} sold</span> : null}
                <button
                  type="button"
                  disabled={t.sold > 0}
                  onClick={() => {
                    if (t.id) onRemove(t.id);
                    update('tickets', draft.tickets.filter((x) => x.key !== t.key));
                  }}
                  className="rounded p-2 text-mute hover:bg-white/5 hover:text-bone disabled:opacity-30"
                  aria-label={`Remove ticket ${i + 1}`}
                  title={t.sold ? 'Ticket types with sales can’t be removed' : 'Remove'}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-6">
              <Input label="Name" required wrapperClassName="sm:col-span-4" value={t.name} onChange={(e) => set(t.key, { name: e.target.value })} error={errors[`t.${i}.name`]} />
              <Input
                label="Price (₹)"
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                wrapperClassName="sm:col-span-2"
                value={t.price}
                disabled={t.sold > 0}
                onChange={(e) => set(t.key, { price: e.target.value })}
                error={errors[`t.${i}.price`]}
              />
              <Input label="Description" optional wrapperClassName="sm:col-span-6" value={t.description} onChange={(e) => set(t.key, { description: e.target.value })} />
              <Input label="Quantity" type="number" min={Math.max(1, t.sold)} wrapperClassName="sm:col-span-2" value={t.quantity} onChange={(e) => set(t.key, { quantity: e.target.value })} error={errors[`t.${i}.quantity`]} />
              <Input label="Max per booking" type="number" min={1} max={10} wrapperClassName="sm:col-span-2" value={t.maxPerOrder} onChange={(e) => set(t.key, { maxPerOrder: e.target.value })} error={errors[`t.${i}.maxPerOrder`]} />
              <div className="hidden sm:col-span-2 sm:block" />
              <Input label="Sales start" optional type="datetime-local" wrapperClassName="sm:col-span-3" value={t.salesStart} onChange={(e) => set(t.key, { salesStart: e.target.value })} error={errors[`t.${i}.salesStart`]} />
              <Input label="Sales end" optional type="datetime-local" wrapperClassName="sm:col-span-3" value={t.salesEnd} onChange={(e) => set(t.key, { salesEnd: e.target.value })} error={errors[`t.${i}.salesEnd`]} />
            </div>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} disabled={draft.tickets.length >= 6} onClick={() => update('tickets', [...draft.tickets, { ...emptyTicket(), name: '' }])}>
          Add ticket type
        </Button>
      </Section>
    </div>
  );
}

function ReviewStep({ draft, categoryName }: { draft: Draft; categoryName: string }) {
  const startIso = zonedInputToIso(draft.starts, draft.timezone);
  const endIso = zonedInputToIso(draft.ends, draft.timezone);
  const checks = useMemo(
    () => [
      ['Cover image added', !!draft.coverImageUrl],
      ['Description of at least 80 characters', draft.description.trim().length >= 80],
      [draft.format === 'ONLINE' ? 'Online link added' : 'Venue and city added', draft.format === 'ONLINE' ? !!draft.onlineUrl : !!(draft.venueName && draft.city) && (draft.format === 'IN_PERSON' || !!draft.onlineUrl)],
      ['At least one ticket type', draft.tickets.length > 0],
      ['Starts at least 24 hours from now', !!startIso && new Date(startIso).getTime() > Date.now() + 24 * 36e5],
    ] as const,
    [draft, startIso],
  );
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <p className="eyebrow mb-4">Listing preview</p>
        <div className="overflow-hidden rounded-md border border-line">
          <Cover src={draft.coverImageUrl} alt={draft.title} category={draft.categorySlug} className="aspect-[16/9]" />
          <div className="p-6">
            <p className="text-[12px] uppercase tracking-[0.12em] text-mute">{categoryName}</p>
            <h3 className="mt-2 font-display text-3xl font-medium leading-tight tracking-tight">{draft.title || 'Untitled event'}</h3>
            <p className="mt-2 text-mute">{draft.summary}</p>
            {startIso && endIso ? <p className="mt-4 text-sm">{eventWhen(startIso, endIso, draft.timezone)}</p> : null}
            <p className="mt-1 text-sm text-mute">{draft.format === 'ONLINE' ? 'Online' : [draft.venueName, draft.city].filter(Boolean).join(', ')}</p>
          </div>
          <ul className="divide-y divide-line border-t border-line">
            {draft.tickets.map((t) => (
              <li key={t.key} className="flex justify-between px-6 py-3 text-sm">
                <span>
                  {t.name} <span className="text-mute">· {t.quantity} available</span>
                </span>
                <span className="tnum">{Number(t.price) ? money(Math.round(Number(t.price) * 100)) : 'Free'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="lg:col-span-5">
        <p className="eyebrow mb-4">Ready to submit?</p>
        <ul className="space-y-3">
          {checks.map(([label, ok]) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              {ok ? <CheckCircle2 className="h-4 w-4 text-volt" /> : <Circle className="h-4 w-4 text-mute-700" />}
              <span className={ok ? 'text-bone' : 'text-mute'}>{label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[13px] leading-relaxed text-mute">
          Submitting sends your event to the AFTR review team. You can’t edit it while it’s under review, but you can withdraw the submission at any time. The server
          re-checks every requirement.
        </p>
      </div>
    </div>
  );
}
