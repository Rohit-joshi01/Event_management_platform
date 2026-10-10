import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { OrganizerSection } from '@/components/marketing/OrganizerSection';
import { ButtonLink } from '@/components/ui/Button';
import { useAuth } from '@/auth/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const FACTS = [
  ['Approval in the loop', 'Every submission is reviewed by an administrator. Rejections must include a written reason, so you always know what to fix.'],
  ['Inventory you can trust', 'Ticket counts are reserved with conditional database updates inside a transaction. Two buyers can’t take the same last seat.'],
  ['One booking per attendee', 'Duplicate registrations are blocked at the database level, not just in the interface.'],
  ['Honest payments', 'Until a payment provider is connected, paid bookings run through a clearly labelled development checkout and are never counted as revenue.'],
  ['Talk to your attendees', 'Send announcements to everyone registered. Delivery is in-app and the recipient count is shown before you send.'],
  ['Export when you need it', 'Download registrations as CSV for door lists, catering numbers or your own records.'],
];

export default function Organizers() {
  useDocumentTitle('For organizers');
  const { user } = useAuth();
  const featured = useQuery({ queryKey: ['events', 'featured'], queryFn: () => api.events.search({ featured: true, size: 6, sort: 'date' }) });
  const lead = featured.data?.content[0];
  const sample = useQuery({ queryKey: ['events', 'detail', lead?.slug], queryFn: () => api.events.detail(lead!.slug), enabled: !!lead });
  const cta = user?.role === 'ORGANIZER' ? '/organizer/events/new' : '/sign-up?role=ORGANIZER';

  return (
    <>
      <section className="grain relative bg-ink pb-20 pt-[calc(var(--nav-h)+5rem)]">
        <div className="container-x grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-9">
            <p className="eyebrow mb-6">For organizers</p>
            <h1 className="font-display text-giant font-medium">
              Bring the idea. <br />
              We’ll handle the <span className="font-serif font-normal italic tracking-normal text-volt">door.</span>
            </h1>
          </div>
          <div className="flex flex-col justify-end gap-6 lg:col-span-3">
            <p className="text-[15px] leading-relaxed text-mute">Publishing, review, ticketing, check-in and attendee updates — in one workspace, with no setup fee.</p>
            <ButtonLink to={cta} size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
              {user?.role === 'ORGANIZER' ? 'Create an event' : 'Create organizer account'}
            </ButtonLink>
          </div>
        </div>
      </section>
      <OrganizerSection sample={sample.data} />
      <section className="bg-ink py-24 lg:py-32" aria-labelledby="facts-title">
        <div className="container-x">
          <h2 id="facts-title" className="mb-12 max-w-3xl font-display text-huge font-medium">
            The parts you don’t see are the parts we took seriously.
          </h2>
          <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {FACTS.map(([t, d], i) => (
              <div key={t} className="bg-ink p-7">
                <p className="tnum text-[12px] text-mute-700">{String(i + 1).padStart(2, '0')}</p>
                <p className="mt-8 font-display text-xl font-medium tracking-tight">{t}</p>
                <p className="mt-2 text-sm leading-relaxed text-mute">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
