import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Bell,
  CalendarPlus,
  CalendarRange,
  ChevronRight,
  ChevronsLeft,
  Compass,
  History,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  ScanLine,
  Settings2,
  ShieldCheck,
  Ticket,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Avatar } from '@/components/ui/Media';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  end?: boolean;
  badge?: 'pending';
}

const NAV: Record<Role, { section: string; items: NavItem[] }[]> = {
  ATTENDEE: [
    {
      section: 'Attendee',
      items: [
        { to: '/account', label: 'Overview', icon: LayoutGrid, end: true },
        { to: '/account/tickets', label: 'My tickets', icon: Ticket },
        { to: '/account/history', label: 'Registration history', icon: History },
        { to: '/events', label: 'Discover events', icon: Compass },
      ],
    },
  ],
  ORGANIZER: [
    {
      section: 'Workspace',
      items: [
        { to: '/organizer', label: 'Overview', icon: LayoutGrid, end: true },
        { to: '/organizer/events', label: 'Events', icon: CalendarRange },
        { to: '/organizer/events/new', label: 'Create event', icon: CalendarPlus },
        { to: '/organizer/analytics', label: 'Analytics', icon: BarChart3 },
        { to: '/organizer/announcements', label: 'Announcements', icon: Megaphone },
        { to: '/organizer/check-in', label: 'Check-in', icon: ScanLine },
      ],
    },
  ],
  ADMIN: [
    {
      section: 'Operations',
      items: [
        { to: '/admin', label: 'Overview', icon: LayoutGrid, end: true },
        { to: '/admin/approvals', label: 'Approvals', icon: ShieldCheck, badge: 'pending' },
        { to: '/admin/events', label: 'Events', icon: CalendarRange },
        { to: '/admin/users', label: 'Users', icon: Users },
        { to: '/admin/activity', label: 'Activity log', icon: Activity },
        { to: '/admin/settings', label: 'Settings', icon: Settings2 },
      ],
    },
  ],
};

const ACCOUNT_ITEMS: NavItem[] = [
  { to: '/me/notifications', label: 'Notifications', icon: Bell },
  { to: '/me/profile', label: 'Profile & security', icon: UserRound },
];

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Administrator', ORGANIZER: 'Organizer', ATTENDEE: 'Attendee' };
const ROOT_LABEL: Record<Role, string> = { ADMIN: 'Admin', ORGANIZER: 'Organizer', ATTENDEE: 'My AFTR' };

// ---------------------------------------------------------------- page title / breadcrumbs

interface Crumb {
  label: string;
  to?: string;
}
const ShellCtx = createContext<{ setCrumbs: (c: Crumb[]) => void } | null>(null);

/** Pages declare their breadcrumb trail (after the role root). */
export function usePageCrumbs(crumbs: Crumb[], title?: string) {
  const ctx = useContext(ShellCtx);
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    ctx?.setCrumbs(crumbs);
    const t = title ?? crumbs[crumbs.length - 1]?.label;
    if (t) document.title = `${t} — AFTR`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, title]);
}

function readCollapsed() {
  try {
    return window.localStorage.getItem('aftr.sidebar') === 'collapsed';
  } catch {
    return false;
  }
}

export function AppShell() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    try {
      window.localStorage.setItem('aftr.sidebar', collapsed ? 'collapsed' : 'open');
    } catch {
      /* storage unavailable */
    }
  }, [collapsed]);

  const unread = useQuery({ queryKey: ['notifications', 'unread'], queryFn: api.notifications.unreadCount, refetchInterval: 60_000, enabled: !!user });
  const pending = useQuery({
    queryKey: ['admin', 'pending-count'],
    queryFn: () => api.admin.events({ status: 'PENDING', size: 1 }),
    enabled: user?.role === 'ADMIN',
    refetchInterval: 60_000,
  });

  const ctx = useMemo(() => ({ setCrumbs }), []);
  if (!user) return null;
  const groups = NAV[user.role];
  const root = groups[0]!.items[0]!.to;

  const onSignOut = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const sidebar = (isMobile: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center border-b border-line', collapsed && !isMobile ? 'justify-center px-0' : 'justify-between px-5')}>
        <Link to="/" aria-label="AFTR home">
          <Logo mark={collapsed && !isMobile} />
        </Link>
        {isMobile ? (
          <button onClick={() => setMobileOpen(false)} className="rounded p-2 text-mute hover:text-bone" aria-label="Close navigation">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Dashboard">
        {groups.map((g) => (
          <div key={g.section} className="mb-6">
            {collapsed && !isMobile ? null : <p className="eyebrow mb-2 px-3">{g.section}</p>}
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <SideLink key={item.to} item={item} collapsed={collapsed && !isMobile} badge={item.badge === 'pending' ? pending.data?.totalElements : undefined} />
              ))}
            </ul>
          </div>
        ))}
        <div>
          {collapsed && !isMobile ? null : <p className="eyebrow mb-2 px-3">Account</p>}
          <ul className="space-y-0.5">
            {ACCOUNT_ITEMS.map((item) => (
              <SideLink key={item.to} item={item} collapsed={collapsed && !isMobile} badge={item.to === '/me/notifications' ? unread.data?.unread : undefined} />
            ))}
          </ul>
        </div>
      </nav>
      <div className="border-t border-line p-3">
        <div className={cn('flex items-center gap-3 rounded px-2 py-2', collapsed && !isMobile && 'justify-center px-0')}>
          <Avatar name={user.fullName} src={user.avatarUrl} size={32} />
          {collapsed && !isMobile ? null : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{user.fullName}</p>
              <p className="truncate text-[11.5px] text-mute">{ROLE_LABEL[user.role]}</p>
            </div>
          )}
        </div>
        {isMobile ? null : (
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={cn('mt-1 flex w-full items-center gap-3 rounded px-3 py-2 text-[13px] text-mute hover:bg-white/[0.04] hover:text-bone', collapsed && 'justify-center px-0')}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronsLeft className={cn('h-4 w-4 transition-transform duration-300', collapsed && 'rotate-180')} />
            {collapsed ? null : 'Collapse'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <ShellCtx.Provider value={ctx}>
      <div className="min-h-screen bg-ink">
        <a href="#app-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-volt focus:px-3 focus:py-2 focus:text-ink">
          Skip to content
        </a>
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-ink-850 transition-[width] duration-300 ease-out-expo lg:block',
            collapsed ? 'w-[68px]' : 'w-[248px]',
          )}
        >
          {sidebar(false)}
        </aside>

        <AnimatePresence>
          {mobileOpen ? (
            <div className="fixed inset-0 z-50 lg:hidden">
              <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
              <motion.aside
                className="absolute inset-y-0 left-0 w-[84vw] max-w-[300px] border-r border-line bg-ink-850"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                {sidebar(true)}
              </motion.aside>
            </div>
          ) : null}
        </AnimatePresence>

        <div className={cn('transition-[padding] duration-300 ease-out-expo', collapsed ? 'lg:pl-[68px]' : 'lg:pl-[248px]')}>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-ink/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <button className="-ml-2 rounded p-2 text-bone lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </button>
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex items-center gap-1.5 text-[13px] text-mute">
                <li className="hidden sm:block">
                  <Link to={root} className="hover:text-bone">
                    {ROOT_LABEL[user.role]}
                  </Link>
                </li>
                {crumbs.map((c, i) => (
                  <li key={i} className={cn('flex min-w-0 items-center gap-1.5', i < crumbs.length - 1 && 'hidden sm:flex')}>
                    <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-mute-700', i === 0 && 'hidden sm:block')} aria-hidden />
                    {c.to && i < crumbs.length - 1 ? (
                      <Link to={c.to} className="truncate hover:text-bone">
                        {c.label}
                      </Link>
                    ) : (
                      <span className="truncate text-bone" aria-current={i === crumbs.length - 1 ? 'page' : undefined}>
                        {c.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
            <Link to="/me/notifications" className="relative rounded p-2 text-mute hover:bg-white/5 hover:text-bone" aria-label={`Notifications${unread.data?.unread ? `, ${unread.data.unread} unread` : ''}`}>
              <Bell className="h-[18px] w-[18px]" />
              {unread.data?.unread ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-volt ring-2 ring-ink" /> : null}
            </Link>
            <ProfileMenu name={user.fullName} email={user.email} avatar={user.avatarUrl} role={user.role} onSignOut={onSignOut} />
          </header>
          <main id="app-main" className="px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pt-8">
            <Outlet />
          </main>
        </div>
      </div>
    </ShellCtx.Provider>
  );
}

function SideLink({ item, collapsed, badge }: { item: NavItem; collapsed: boolean; badge?: number }) {
  const Icon = item.icon;
  const { pathname } = useLocation();
  // "Events" shouldn't light up alongside its own "Create event" child.
  const suppressed = item.to === '/organizer/events' && pathname === '/organizer/events/new';
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        title={collapsed ? item.label : undefined}
        className={({ isActive: raw }) =>
          cn(
            'group relative flex h-9 items-center gap-3 rounded px-3 text-[13.5px] transition-colors',
            raw && !suppressed ? 'bg-white/[0.06] text-bone' : 'text-bone/65 hover:bg-white/[0.03] hover:text-bone',
            collapsed && 'justify-center px-0',
          )
        }
      >
        {({ isActive: raw }) => {
          const isActive = raw && !suppressed;
          return (
          <>
            {isActive ? <motion.span layoutId="side-active" className="absolute left-0 top-2 h-5 w-[2px] rounded-full bg-volt" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} /> : null}
            <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-volt' : 'text-mute group-hover:text-bone/80')} aria-hidden />
            {collapsed ? null : <span className="flex-1 truncate">{item.label}</span>}
            {badge ? (
              <span className={cn('tnum rounded-sm bg-volt px-1.5 text-[11px] font-medium text-ink', collapsed && 'absolute right-1 top-1 px-1 text-[9px]')}>{badge > 99 ? '99+' : badge}</span>
            ) : null}
          </>
          );
        }}
      </NavLink>
    </li>
  );
}

function ProfileMenu({ name, email, avatar, role, onSignOut }: { name: string; email: string; avatar: string | null; role: Role; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded p-1 hover:bg-white/5" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        <Avatar name={name} src={avatar} size={30} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-[calc(100%+8px)] w-64 origin-top-right overflow-hidden rounded-md border border-line bg-ink-800 shadow-2xl"
          >
            <div className="border-b border-line px-4 py-3">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-[12.5px] text-mute">{email}</p>
              <p className="eyebrow mt-2 text-volt">{ROLE_LABEL[role]}</p>
            </div>
            <MenuItem to="/me/profile" icon={<UserRound className="h-4 w-4" />} label="Profile & security" onClick={() => setOpen(false)} />
            <MenuItem to="/me/notifications" icon={<Bell className="h-4 w-4" />} label="Notifications" onClick={() => setOpen(false)} />
            <MenuItem to="/events" icon={<Compass className="h-4 w-4" />} label="Browse events" onClick={() => setOpen(false)} />
            <button role="menuitem" onClick={onSignOut} className="flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-left text-sm text-bone/80 hover:bg-white/5 hover:text-bone">
              <LogOut className="h-4 w-4 text-mute" />
              Sign out
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ to, icon, label, onClick }: { to: string; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <Link role="menuitem" to={to} onClick={onClick} className="flex items-center gap-3 px-4 py-2.5 text-sm text-bone/80 hover:bg-white/5 hover:text-bone">
      <span className="text-mute">{icon}</span>
      {label}
    </Link>
  );
}

/** Standard dashboard page heading. */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="font-display text-[clamp(1.7rem,3vw,2.4rem)] font-medium leading-[1.05] tracking-[-0.035em]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-mute">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
