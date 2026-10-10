import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function Legal() {
  useDocumentTitle('Terms & privacy');
  return (
    <div className="container-x max-w-3xl pb-24 pt-[calc(var(--nav-h)+5rem)]">
      <p className="eyebrow mb-6">Legal</p>
      <h1 className="font-display text-huge font-medium">Terms & privacy</h1>
      <p className="mt-4 text-sm text-mute">AFTR is an academic project. These terms describe how this deployment behaves; they are not a substitute for legal advice.</p>

      <section id="terms" className="mt-14 scroll-mt-28 space-y-4 text-[15.5px] leading-relaxed text-bone/80">
        <h2 className="font-display text-2xl font-medium text-bone">Terms of use</h2>
        <p>Organizers are responsible for the accuracy of their listings, including dates, venues and ticket terms. Events are published only after review by an administrator, who may reject a submission with a written reason.</p>
        <p>Bookings can be cancelled by the attendee until the event starts. If an organizer or administrator cancels an event, every booking for it is cancelled and attendees are notified in the app.</p>
        <p>No payment provider is connected to this deployment. Paid tickets are processed through a development checkout that records a simulated payment; no money is charged or received.</p>
        <p>Accounts that misuse the platform may be suspended by an administrator. Administrative actions are recorded in an audit log.</p>
      </section>

      <section id="privacy" className="mt-14 scroll-mt-28 space-y-4 text-[15.5px] leading-relaxed text-bone/80">
        <h2 className="font-display text-2xl font-medium text-bone">Privacy notice</h2>
        <p>We store your name, email address, role, optional profile details and your bookings. Passwords are stored only as BCrypt hashes.</p>
        <p>Organizers can see the name and email of people registered for their own events, so they can run the door and send announcements. Administrators can see account details to operate the platform.</p>
        <p>Ticket QR codes contain only a random identifier — no personal information. Sessions use a secure, HTTP-only cookie.</p>
        <p>Notifications are delivered inside the app. This deployment does not send email.</p>
      </section>
    </div>
  );
}
