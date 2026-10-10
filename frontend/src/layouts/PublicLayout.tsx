import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { PublicNav } from './PublicNav';
import { Footer } from './Footer';

export function PublicLayout() {
  const { pathname } = useLocation();
  const overHero = pathname === '/' || /^\/events\/[^/]+$/.test(pathname) || pathname === '/organizers';
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-volt focus:px-3 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <PublicNav overHero={overHero} />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
