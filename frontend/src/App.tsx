import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AppShell } from '@/layouts/AppShell';
import { RequireRole } from '@/auth/RequireRole';
import { FullPageLoader } from '@/components/app/FullPageLoader';
import { NotFoundPage } from '@/pages/public/StatusPages';

const Landing = lazy(() => import('@/pages/public/Landing'));
const Discover = lazy(() => import('@/pages/public/Discover'));
const EventDetailPage = lazy(() => import('@/pages/public/EventDetailPage'));
const SignIn = lazy(() => import('@/pages/public/SignIn'));
const SignUp = lazy(() => import('@/pages/public/SignUp'));
const Organizers = lazy(() => import('@/pages/public/Organizers'));
const About = lazy(() => import('@/pages/public/About'));
const Legal = lazy(() => import('@/pages/public/Legal'));

const AttendeeOverview = lazy(() => import('@/pages/account/AttendeeOverview'));
const MyTickets = lazy(() => import('@/pages/account/MyTickets'));
const TicketDetail = lazy(() => import('@/pages/account/TicketDetail'));
const RegistrationHistory = lazy(() => import('@/pages/account/RegistrationHistory'));

const Notifications = lazy(() => import('@/pages/shared/Notifications'));
const Profile = lazy(() => import('@/pages/shared/Profile'));

const OrganizerOverview = lazy(() => import('@/pages/organizer/OrganizerOverview'));
const OrganizerEvents = lazy(() => import('@/pages/organizer/OrganizerEvents'));
const EventWizard = lazy(() => import('@/pages/organizer/EventWizard'));
const EventManage = lazy(() => import('@/pages/organizer/EventManage'));
const OrganizerAnalytics = lazy(() => import('@/pages/organizer/OrganizerAnalytics'));
const OrganizerAnnouncements = lazy(() => import('@/pages/organizer/OrganizerAnnouncements'));
const CheckIn = lazy(() => import('@/pages/organizer/CheckIn'));

const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview'));
const Approvals = lazy(() => import('@/pages/admin/Approvals'));
const AdminEvents = lazy(() => import('@/pages/admin/AdminEvents'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const ActivityLog = lazy(() => import('@/pages/admin/ActivityLog'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Landing />} />
          <Route path="events" element={<Discover />} />
          <Route path="events/:slug" element={<EventDetailPage />} />
          <Route path="organizers" element={<Organizers />} />
          <Route path="about" element={<About />} />
          <Route path="legal" element={<Legal />} />
          <Route path="sign-in" element={<SignIn />} />
          <Route path="sign-up" element={<SignUp />} />
        </Route>

        <Route
          element={
            <RequireRole>
              <AppShell />
            </RequireRole>
          }
        >
          <Route path="me/notifications" element={<Notifications />} />
          <Route path="me/profile" element={<Profile />} />

          <Route path="account" element={<RequireRole roles={['ATTENDEE']}><AttendeeOverview /></RequireRole>} />
          <Route path="account/tickets" element={<RequireRole roles={['ATTENDEE']}><MyTickets /></RequireRole>} />
          <Route path="account/tickets/:reference" element={<RequireRole roles={['ATTENDEE']}><TicketDetail /></RequireRole>} />
          <Route path="account/history" element={<RequireRole roles={['ATTENDEE']}><RegistrationHistory /></RequireRole>} />
          <Route path="account/profile" element={<Navigate to="/me/profile" replace />} />

          <Route path="organizer" element={<RequireRole roles={['ORGANIZER']}><OrganizerOverview /></RequireRole>} />
          <Route path="organizer/events" element={<RequireRole roles={['ORGANIZER']}><OrganizerEvents /></RequireRole>} />
          <Route path="organizer/events/new" element={<RequireRole roles={['ORGANIZER']}><EventWizard /></RequireRole>} />
          <Route path="organizer/events/:id/edit" element={<RequireRole roles={['ORGANIZER']}><EventWizard /></RequireRole>} />
          <Route path="organizer/events/:id" element={<RequireRole roles={['ORGANIZER']}><EventManage /></RequireRole>} />
          <Route path="organizer/events/:id/:tab" element={<RequireRole roles={['ORGANIZER']}><EventManage /></RequireRole>} />
          <Route path="organizer/analytics" element={<RequireRole roles={['ORGANIZER']}><OrganizerAnalytics /></RequireRole>} />
          <Route path="organizer/announcements" element={<RequireRole roles={['ORGANIZER']}><OrganizerAnnouncements /></RequireRole>} />
          <Route path="organizer/check-in" element={<RequireRole roles={['ORGANIZER']}><CheckIn /></RequireRole>} />

          <Route path="admin" element={<RequireRole roles={['ADMIN']}><AdminOverview /></RequireRole>} />
          <Route path="admin/approvals" element={<RequireRole roles={['ADMIN']}><Approvals /></RequireRole>} />
          <Route path="admin/events" element={<RequireRole roles={['ADMIN']}><AdminEvents /></RequireRole>} />
          <Route path="admin/users" element={<RequireRole roles={['ADMIN']}><AdminUsers /></RequireRole>} />
          <Route path="admin/activity" element={<RequireRole roles={['ADMIN']}><ActivityLog /></RequireRole>} />
          <Route path="admin/settings" element={<RequireRole roles={['ADMIN']}><AdminSettings /></RequireRole>} />
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
