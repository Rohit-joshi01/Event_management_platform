import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { Role } from '@/lib/types';
import { FullPageLoader } from '@/components/app/FullPageLoader';
import { ForbiddenPage } from '@/pages/public/StatusPages';

/**
 * Client-side route guard for UX only. Every protected API call is authorised again by
 * Spring Security on the server, so bypassing this guard grants nothing.
 */
export function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to={`/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(user.role)) return <ForbiddenPage role={user.role} />;
  return <>{children}</>;
}
