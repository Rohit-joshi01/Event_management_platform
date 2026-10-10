import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden border-t border-line bg-ink">
      <div className="container-x pb-10 pt-20 sm:pt-28">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="eyebrow mb-6">The room is open</p>
            <p className="font-display text-giant font-medium">
              See you <span className="font-serif italic font-normal tracking-normal text-volt">after.</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3 lg:col-span-5 lg:pt-12">
            <FooterCol
              title="Explore"
              links={[
                ['/events', 'All events'],
                ['/events?sort=popular', 'Trending'],
                ['/events?price=free', 'Free this month'],
              ]}
            />
            <FooterCol
              title="Organize"
              links={[
                ['/organizers', 'Why AFTR'],
                ['/sign-up?role=ORGANIZER', 'Create an account'],
                ['/organizer/events/new', 'Publish an event'],
              ]}
            />
            <FooterCol
              title="Account"
              links={[
                ['/sign-in', 'Sign in'],
                ['/account/tickets', 'My tickets'],
                ['/about', 'About AFTR'],
              ]}
            />
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-6 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/sign-up?role=ORGANIZER" className="group inline-flex items-center gap-3 text-[15px] text-bone">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line-strong transition-colors group-hover:border-volt group-hover:bg-volt group-hover:text-ink">
              <ArrowRight className="h-4 w-4" />
            </span>
            Hosting something? Put it on AFTR.
          </Link>
          <div className="flex items-center gap-6 text-[12.5px] text-mute">
            <Logo mark />
            <span>© {year} AFTR</span>
            <Link to="/legal#terms" className="hover:text-bone">
              Terms
            </Link>
            <Link to="/legal#privacy" className="hover:text-bone">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="eyebrow mb-4">{title}</p>
      <ul className="space-y-2.5">
        {links.map(([to, label]) => (
          <li key={to}>
            <Link to={to} className="link-underline text-bone/80 hover:text-bone">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
