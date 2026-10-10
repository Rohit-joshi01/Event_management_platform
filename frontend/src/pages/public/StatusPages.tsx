import { Link } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { homeFor } from '@/auth/AuthContext';
import type { Role } from '@/lib/types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Not found');
  return (
    <section className="container-x flex min-h-[80vh] flex-col justify-end pb-24 pt-40">
      <p className="eyebrow mb-6">Error 404</p>
      <h1 className="font-display text-giant font-medium">
        This room is <span className="font-serif font-normal italic tracking-normal text-volt">empty.</span>
      </h1>
      <p className="mt-6 max-w-lg text-lg text-mute">The page you were looking for doesn’t exist, or the event has moved.</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink to="/events" size="lg">
          Browse events
        </ButtonLink>
        <ButtonLink to="/" variant="secondary" size="lg" icon={<ArrowLeft className="h-4 w-4" />}>
          Back home
        </ButtonLink>
      </div>
    </section>
  );
}

export function ForbiddenPage({ role }: { role: Role }) {
  useDocumentTitle('No access');
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-line-strong">
          <Lock className="h-5 w-5 text-mute" />
        </div>
        <p className="eyebrow mb-3">Error 403</p>
        <h1 className="font-display text-3xl font-medium tracking-tight">This area isn’t part of your account</h1>
        <p className="mt-3 text-mute">
          You’re signed in as {role === 'ADMIN' ? 'an administrator' : role === 'ORGANIZER' ? 'an organizer' : 'an attendee'}. Access is checked by
          the server, so this page can’t be unlocked from the browser.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink to={homeFor(role)}>Go to my dashboard</ButtonLink>
          <Link to="/" className="inline-flex h-10 items-center px-4 text-sm text-mute hover:text-bone">
            Home
          </Link>
        </div>
      </div>
    </section>
  );
}
