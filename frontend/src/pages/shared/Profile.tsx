import { useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, KeyRound, Mail, Save } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader, usePageCrumbs } from '@/layouts/AppShell';
import { Input, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Media';
import { Panel } from '@/components/ui/Panel';
import { useToast } from '@/components/ui/Toast';
import { shortDate } from '@/lib/format';

export default function Profile() {
  usePageCrumbs([{ label: 'Profile & security' }]);
  const { user, setUser } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    bio: user?.bio ?? '',
    avatarUrl: user?.avatarUrl ?? '',
    organizationName: user?.organizationName ?? '',
    city: user?.city ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [email, setEmail] = useState({ value: '', password: '' });
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () =>
      api.me.update({
        ...form,
        notifyAnnouncements: user!.notifyAnnouncements,
        notifyReminders: user!.notifyReminders,
        notifyRecommendations: user!.notifyRecommendations,
      }),
    onSuccess: (u) => {
      setUser(u);
      setErrors({});
      toast.success('Profile saved');
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(e.fieldMap());
      toast.error('Couldn’t save profile', e instanceof ApiError ? e.message : undefined);
    },
  });

  const upload = useMutation({
    mutationFn: (f: File) => api.uploads.image(f),
    onSuccess: (r) => setForm((s) => ({ ...s, avatarUrl: r.url })),
    onError: (e) => toast.error('Upload failed', e instanceof ApiError ? e.message : undefined),
  });

  const changePw = useMutation({
    mutationFn: () => api.me.changePassword(pw.current, pw.next),
    onSuccess: () => {
      setPw({ current: '', next: '', confirm: '' });
      setPwErrors({});
      toast.success('Password changed');
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        const map = e.fieldMap();
        if (e.code === 'WRONG_PASSWORD') map.currentPassword = e.message;
        if (e.code === 'SAME_PASSWORD') map.newPassword = e.message;
        setPwErrors(map);
      }
    },
  });

  const changeEmail = useMutation({
    mutationFn: () => api.me.changeEmail(email.value.trim(), email.password),
    onSuccess: (u) => {
      setUser(u);
      setEmail({ value: '', password: '' });
      setEmailErrors({});
      toast.success('Email updated', `You now sign in with ${u.email}.`);
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        const map = e.fieldMap();
        if (e.code === 'WRONG_PASSWORD') map.currentPassword = e.message;
        if (e.code === 'EMAIL_TAKEN') map.newEmail = e.message;
        setEmailErrors(map);
      }
    },
  });

  if (!user) return null;

  const submitProfile = (e: FormEvent) => {
    e.preventDefault();
    if (form.fullName.trim().length < 2) return setErrors({ fullName: 'Name can’t be empty.' });
    save.mutate();
  };

  const submitPw = (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (!pw.current) v.currentPassword = 'Enter your current password.';
    if (pw.next.length < 8 || !/[A-Za-z]/.test(pw.next) || !/\d/.test(pw.next)) v.newPassword = 'Use at least 8 characters with a letter and a number.';
    if (pw.next !== pw.confirm) v.confirm = 'Passwords don’t match.';
    setPwErrors(v);
    if (!Object.keys(v).length) changePw.mutate();
  };

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) v.newEmail = 'Enter a valid email address.';
    if (!email.password) v.currentPassword = 'Confirm with your current password.';
    setEmailErrors(v);
    if (!Object.keys(v).length) changeEmail.mutate();
  };

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeader title="Profile & security" description={`Member since ${shortDate(user.createdAt)}. Your role is set by the platform and can’t be changed here.`} />
      <div className="grid gap-6 lg:grid-cols-12">
        <form onSubmit={submitProfile} className="lg:col-span-7">
          <Panel title="Profile">
            <div className="mb-6 flex items-center gap-5">
              <Avatar name={form.fullName || user.fullName} src={form.avatarUrl} size={72} />
              <div>
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
                <Button type="button" variant="secondary" size="sm" icon={<Camera className="h-4 w-4" />} loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                  Upload photo
                </Button>
                {form.avatarUrl ? (
                  <button type="button" className="ml-3 text-[12.5px] text-mute hover:text-bone" onClick={() => setForm((s) => ({ ...s, avatarUrl: '' }))}>
                    Remove
                  </button>
                ) : null}
                <p className="mt-2 text-[12px] text-mute">JPEG, PNG or WebP, up to 5 MB.</p>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Full name" value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} error={errors.fullName} required wrapperClassName="sm:col-span-2" />
              {user.role === 'ORGANIZER' ? (
                <Input label="Organization" optional value={form.organizationName} onChange={(e) => setForm((s) => ({ ...s, organizationName: e.target.value }))} error={errors.organizationName} />
              ) : null}
              <Input label="City" optional value={form.city} onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))} error={errors.city} />
              <Textarea
                label="Bio"
                optional
                wrapperClassName="sm:col-span-2"
                maxLength={600}
                value={form.bio}
                onChange={(e) => setForm((s) => ({ ...s, bio: e.target.value }))}
                error={errors.bio}
                hint={user.role === 'ORGANIZER' ? 'Shown on your event pages.' : `${form.bio.length}/600`}
              />
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="submit" icon={<Save className="h-4 w-4" />} loading={save.isPending}>
                Save profile
              </Button>
            </div>
          </Panel>
        </form>

        <div className="space-y-6 lg:col-span-5">
          <form onSubmit={submitPw}>
            <Panel title="Password" eyebrow="Security">
              <div className="space-y-4">
                <Input label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))} error={pwErrors.currentPassword} />
                <Input label="New password" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))} error={pwErrors.newPassword} />
                <Input label="Confirm new password" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} error={pwErrors.confirm} />
              </div>
              <div className="mt-5 flex justify-end">
                <Button type="submit" variant="secondary" icon={<KeyRound className="h-4 w-4" />} loading={changePw.isPending}>
                  Change password
                </Button>
              </div>
            </Panel>
          </form>
          <form onSubmit={submitEmail}>
            <Panel title="Sign-in email" eyebrow={user.email}>
              <div className="space-y-4">
                <Input label="New email" type="email" value={email.value} onChange={(e) => setEmail((s) => ({ ...s, value: e.target.value }))} error={emailErrors.newEmail} />
                <Input label="Current password" type="password" autoComplete="current-password" value={email.password} onChange={(e) => setEmail((s) => ({ ...s, password: e.target.value }))} error={emailErrors.currentPassword} />
                <p className="text-[12px] leading-relaxed text-mute">No email provider is configured, so the new address isn’t verified by link. The change is confirmed with your password and recorded in the audit log.</p>
              </div>
              <div className="mt-5 flex justify-end">
                <Button type="submit" variant="secondary" icon={<Mail className="h-4 w-4" />} loading={changeEmail.isPending}>
                  Update email
                </Button>
              </div>
            </Panel>
          </form>
        </div>
      </div>
    </div>
  );
}
