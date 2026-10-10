import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarPlus, Ticket } from 'lucide-react';
import { AuthLayout } from '@/components/app/AuthLayout';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { homeFor, useAuth } from '@/auth/AuthContext';
import { api, ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/lib/cn';

type AccountRole = 'ATTENDEE' | 'ORGANIZER';

export default function SignUp() {
  useDocumentTitle('Create an account');
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState<AccountRole>(params.get('role') === 'ORGANIZER' ? 'ORGANIZER' : 'ATTENDEE');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', organizationName: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const settings = useQuery({ queryKey: ['settings', 'public'], queryFn: api.settings.public });
  const next = params.get('next');

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const closed = role === 'ORGANIZER' ? settings.data?.allowOrganizerSignup === false : settings.data?.allowAttendeeSignup === false;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (form.fullName.trim().length < 2) v.fullName = 'Enter your full name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) v.email = 'Enter a valid email address.';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
      v.password = 'Use at least 8 characters with at least one letter and one number.';
    setErrors(v);
    setFormError(null);
    if (Object.keys(v).length) return;
    setLoading(true);
    try {
      const u = await register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        role,
        organizationName: role === 'ORGANIZER' ? form.organizationName.trim() || undefined : undefined,
      });
      const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : u.role === 'ORGANIZER' ? '/organizer/events/new' : homeFor(u.role);
      navigate(dest, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldMap());
        setFormError(err.message);
      } else setFormError('Sign-up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      kicker="Create an account"
      title={role === 'ORGANIZER' ? 'Start hosting on AFTR' : 'Join AFTR'}
      aside={
        <p className="max-w-xl font-display text-[clamp(2.4rem,4.5vw,4.6rem)] font-medium leading-[0.95] tracking-[-0.045em]">
          {role === 'ORGANIZER' ? (
            <>
              Publish once. <span className="text-volt">Sell out properly.</span>
            </>
          ) : (
            <>
              Find the thing <span className="text-volt">you’ll talk about on Monday.</span>
            </>
          )}
        </p>
      }
    >
      <div role="radiogroup" aria-label="Account type" className="mb-8 grid grid-cols-2 gap-2">
        {(
          [
            ['ATTENDEE', 'I’m attending', 'Book tickets and keep them in one place', Ticket],
            ['ORGANIZER', 'I’m organizing', 'Publish events and manage registrations', CalendarPlus],
          ] as const
        ).map(([value, label, desc, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={role === value}
            onClick={() => setRole(value)}
            className={cn(
              'rounded-md border p-4 text-left transition-colors',
              role === value ? 'border-volt bg-volt/[0.06]' : 'border-line hover:border-line-strong',
            )}
          >
            <Icon className={cn('h-4 w-4', role === value ? 'text-volt' : 'text-mute')} />
            <p className="mt-3 text-sm font-medium">{label}</p>
            <p className="mt-1 text-[12px] leading-snug text-mute">{desc}</p>
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="space-y-5">
        {formError ? (
          <div role="alert" className="rounded border border-signal-danger/40 bg-signal-danger/[0.07] px-4 py-3 text-sm text-[#ffb3ab]">
            {formError}
          </div>
        ) : null}
        {closed ? (
          <div className="rounded border border-signal-warn/40 bg-signal-warn/[0.06] px-4 py-3 text-sm">
            {role === 'ORGANIZER' ? 'Organizer' : 'Attendee'} sign-ups are currently closed by the platform administrators.
          </div>
        ) : null}
        <Input label="Full name" autoComplete="name" value={form.fullName} onChange={set('fullName')} error={errors.fullName} required />
        {role === 'ORGANIZER' ? (
          <Input label="Organization or collective" optional value={form.organizationName} onChange={set('organizationName')} error={errors.organizationName} hint="Shown on your event pages." />
        ) : null}
        <Input label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} required />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
          required
        />
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={closed} iconRight={<ArrowRight className="h-4 w-4" />}>
          Create account
        </Button>
        <p className="text-center text-sm text-mute">
          Already have an account?{' '}
          <Link to="/sign-in" className="text-bone underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
