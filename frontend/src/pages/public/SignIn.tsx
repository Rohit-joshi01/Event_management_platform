import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, KeyRound, Mail } from 'lucide-react';
import { AuthLayout } from '@/components/app/AuthLayout';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { homeFor, useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const DEMO = [
  { role: 'Attendee', email: 'attendee@aftr.dev', password: 'Attendee@2026' },
  { role: 'Organizer', email: 'organizer@aftr.dev', password: 'Organizer@2026' },
  { role: 'Admin', email: 'admin@aftr.dev', password: 'Admin@2026' },
];
const SHOW_DEMO = import.meta.env.DEV;

/** Only same-site relative paths are honoured as post-login destinations. */
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export default function SignIn() {
  useDocumentTitle('Sign in');
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={next ?? homeFor(user.role)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) v.email = 'Enter a valid email address.';
    if (!password) v.password = 'Enter your password.';
    setErrors(v);
    setFormError(null);
    if (Object.keys(v).length) return;
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      navigate(next ?? homeFor(u.role), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldMap());
        setFormError(err.message);
      } else setFormError('Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      kicker="Welcome back"
      title={
        <>
          Sign in to <span className="font-serif font-normal italic tracking-normal">AFTR</span>
        </>
      }
      aside={
        <p className="max-w-xl font-display text-[clamp(2.4rem,4.5vw,4.6rem)] font-medium leading-[0.95] tracking-[-0.045em]">
          Your tickets, your events, your room — <span className="text-volt">right where you left them.</span>
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {formError ? (
          <div role="alert" className="rounded border border-signal-danger/40 bg-signal-danger/[0.07] px-4 py-3 text-sm text-[#ffb3ab]">
            {formError}
          </div>
        ) : null}
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} leading={<Mail className="h-4 w-4" />} required />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          leading={<KeyRound className="h-4 w-4" />}
          required
        />
        <Button type="submit" size="lg" className="w-full" loading={loading} iconRight={<ArrowRight className="h-4 w-4" />}>
          Sign in
        </Button>
        <p className="text-center text-sm text-mute">
          New here?{' '}
          <Link to={`/sign-up${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-bone underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </form>

      {SHOW_DEMO ? (
        <div className="mt-10 rounded-md border border-dashed border-line-strong p-4">
          <p className="eyebrow mb-3">Demo accounts · seeded data</p>
          <ul className="space-y-1.5">
            {DEMO.map((d) => (
              <li key={d.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                  }}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[13px] hover:bg-white/5"
                >
                  <span className="text-bone/90">{d.role}</span>
                  <span className="font-mono text-[12px] text-mute">{d.email}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-2 text-[11.5px] text-mute-700">Click to fill. Shown only in development builds.</p>
        </div>
      ) : null}
    </AuthLayout>
  );
}
