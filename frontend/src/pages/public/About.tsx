import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ButtonLink } from '@/components/ui/Button';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { num } from '@/lib/format';

export default function About() {
  useDocumentTitle('About');
  const meta = useQuery({ queryKey: ['events', 'meta'], queryFn: api.events.meta });
  const upcoming = meta.data?.categories.reduce((s, c) => s + c.upcomingCount, 0);
  return (
    <div className="pb-24 pt-[calc(var(--nav-h)+5rem)]">
      <section className="container-x grid gap-10 lg:grid-cols-12">
        <p className="eyebrow lg:col-span-3">About AFTR</p>
        <div className="lg:col-span-9">
          <h1 className="font-display text-giant font-medium">
            A platform for the part of life that happens <span className="font-serif font-normal italic tracking-normal text-volt">after</span> the work is done.
          </h1>
          <div className="mt-14 grid gap-10 text-[16.5px] leading-[1.75] text-bone/80 md:grid-cols-2">
            <p>
              AFTR started as a question: why do the best events in a city — the small workshop, the room-sized gig, the founders’ dinner — live in group chats
              and screenshots? We built one place where they can be found, booked and run properly.
            </p>
            <p>
              Attendees get a calm, editorial programme and tickets that work at the door. Organizers get a workspace that handles review, inventory and
              communication. Administrators get the controls and audit trail a platform needs to stay trustworthy.
            </p>
          </div>
        </div>
      </section>
      <section className="container-x mt-24">
        <dl className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
          {[
            ['Upcoming events', upcoming !== undefined ? num(upcoming) : '—'],
            ['Cities', meta.data ? num(meta.data.cities.length) : '—'],
            ['Categories', meta.data ? num(meta.data.categories.length) : '—'],
          ].map(([k, v]) => (
            <div key={k} className="bg-ink p-8">
              <dt className="eyebrow">{k}</dt>
              <dd className="tnum mt-6 font-display text-6xl font-medium tracking-tight">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12.5px] text-mute-700">Live figures from the platform’s published listings.</p>
      </section>
      <section className="container-x mt-24 flex flex-wrap gap-3">
        <ButtonLink to="/events" size="lg">
          Browse the programme
        </ButtonLink>
        <ButtonLink to="/organizers" variant="secondary" size="lg">
          Host an event
        </ButtonLink>
      </section>
    </div>
  );
}
