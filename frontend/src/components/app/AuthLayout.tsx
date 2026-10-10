import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArmillaryFallback } from '@/components/marketing/ArmillaryFallback';

export function AuthLayout({ title, kicker, children, aside }: { title: ReactNode; kicker: string; children: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-12">
      <div className="flex flex-col px-4 pb-16 pt-[calc(var(--nav-h)+2.5rem)] sm:px-10 lg:col-span-6 lg:px-16 xl:col-span-5">
        <div className="mx-auto w-full max-w-[420px]">
          <p className="eyebrow mb-4">{kicker}</p>
          <h1 className="font-display text-[clamp(2.2rem,4vw,3.2rem)] font-medium leading-[1] tracking-[-0.04em]">{title}</h1>
          <div className="mt-10">{children}</div>
        </div>
      </div>
      <div className="grain relative hidden overflow-hidden border-l border-line bg-ink-850 lg:col-span-6 lg:block xl:col-span-7">
        <div className="absolute inset-x-0 top-0 h-[62%] opacity-80">
          <ArmillaryFallback compact={false} />
        </div>
        <div className="relative flex h-full flex-col justify-end p-14">
          {aside}
          <p className="mt-8 text-[12px] text-mute-700">
            By continuing you agree to the{' '}
            <Link to="/legal#terms" className="underline">
              terms
            </Link>{' '}
            and{' '}
            <Link to="/legal#privacy" className="underline">
              privacy notice
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
