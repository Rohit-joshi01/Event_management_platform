import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Media';
import { homeFor, useAuth } from '@/auth/AuthContext';
import { cn } from '@/lib/cn';

const LINKS = [
  { to: '/events', label: 'Discover Events' },
  { to: '/organizers', label: 'For Organizers' },
  { to: '/about', label: 'About' },
];

export function PublicNav({ overHero = false }: { overHero?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  const solid = scrolled || !overHero || open;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500 ease-out-expo',
        solid ? 'border-b border-line/80 bg-ink/80 backdrop-blur-xl' : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="container-x flex h-[var(--nav-h)] items-center justify-between gap-6">
        <Link to="/" className="shrink-0" aria-label="AFTR home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className="relative px-3 py-2 text-[14px] text-bone/75 transition-colors hover:text-bone">
              {({ isActive }) => (
                <>
                  <span className={cn(isActive && 'text-bone')}>{l.label}</span>
                  {isActive ? (
                    <motion.span layoutId="nav-active" className="absolute inset-x-3 -bottom-[1px] h-px bg-volt" transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Link to={homeFor(user.role)} className="flex items-center gap-2 rounded px-2 py-1.5 text-[14px] text-bone/80 hover:bg-white/5 hover:text-bone">
              <Avatar name={user.fullName} src={user.avatarUrl} size={26} />
              Dashboard
            </Link>
          ) : (
            <Link to="/sign-in" className="link-underline px-3 py-2 text-[14px] text-bone/80 hover:text-bone">
              Sign in
            </Link>
          )}
          <ButtonLink to="/events" size="sm" className="h-9 px-4" iconRight={<ArrowUpRight className="h-3.5 w-3.5" />}>
            Explore Events
          </ButtonLink>
        </div>

        <button
          className="-mr-2 flex h-10 w-10 items-center justify-center rounded text-bone md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.nav
            id="mobile-nav"
            aria-label="Mobile"
            className="fixed inset-x-0 bottom-0 top-[var(--nav-h)] overflow-y-auto bg-ink md:hidden"
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)' }}
            exit={{ clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="container-x flex min-h-full flex-col justify-between py-8">
              <ul className="space-y-1">
                {[{ to: '/', label: 'Home' }, ...LINKS].map((l, i) => (
                  <motion.li key={l.to} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                    <Link to={l.to} className="flex items-baseline justify-between border-b border-line py-4 font-display text-[2.1rem] font-medium tracking-[-0.04em]">
                      {l.label}
                      <span className="font-sans text-xs text-mute tnum">0{i + 1}</span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <div className="mt-10 flex flex-col gap-3">
                {user ? (
                  <ButtonLink to={homeFor(user.role)} variant="secondary" size="lg">
                    Go to dashboard
                  </ButtonLink>
                ) : (
                  <ButtonLink to="/sign-in" variant="secondary" size="lg">
                    Sign in
                  </ButtonLink>
                )}
                <ButtonLink to="/events" size="lg">
                  Explore Events
                </ButtonLink>
              </div>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
