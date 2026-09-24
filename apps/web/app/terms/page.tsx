import { PolicyLayout, PolicySection } from '@/components/layout/policy-layout';

export const metadata = {
  title: 'Terms of Service — PulseSeat',
  description: 'The terms that govern your use of PulseSeat.',
};

export default function TermsPage() {
  return (
    <PolicyLayout
      icon="terms"
      title="Terms of Service"
      updated="September 2026"
      intro="The rules and expectations that govern your use of the PulseSeat platform."
    >
      <PolicySection title="1. Using PulseSeat">
        <p>
          By creating an account or booking a ticket, you agree to these terms. You must provide accurate
          registration details and are responsible for keeping your account credentials and OTP codes private.
        </p>
      </PolicySection>

      <PolicySection title="2. Bookings and seat holds">
        <p>
          Selecting seats on the seat map holds them for a limited window (typically 15 minutes) while you
          complete checkout. If checkout is not completed in time, the hold expires and the seats return to
          general availability. A booking is only confirmed after successful payment.
        </p>
      </PolicySection>

      <PolicySection title="3. Payments">
        <p>
          Prices are shown in Indian Rupees and include applicable taxes unless stated otherwise. A convenience
          fee may be added at checkout and is displayed before you pay. We may cancel and refund any booking
          affected by technical error or fraudulent activity.
        </p>
      </PolicySection>

      <PolicySection title="4. Your responsibilities">
        <ul className="list-disc pl-5 space-y-1">
          <li>Do not attempt to reserve or purchase seats through automated means, bots, or scripts</li>
          <li>Do not book seats for resale where prohibited by the event organizer</li>
          <li>Do not misuse the platform to disrupt availability for other customers</li>
        </ul>
      </PolicySection>

      <PolicySection title="5. Cancellations">
        <p>
          Cancellation and refund eligibility for each event is described in our Refund Policy. Event
          organizers — not PulseSeat — set the underlying cancellation terms for their events.
        </p>
      </PolicySection>

      <PolicySection title="6. Event changes">
        <p>
          If an event is rescheduled or cancelled by the organizer, we will notify you using the contact details
          on your account and process eligible refunds as described in the Refund Policy.
        </p>
      </PolicySection>

      <PolicySection title="7. Service availability">
        <p>
          We aim for high availability but do not guarantee uninterrupted service. Features may change, and we
          may suspend accounts that violate these terms.
        </p>
      </PolicySection>

      <PolicySection title="8. Limitation of liability">
        <p>
          To the maximum extent permitted by law, PulseSeat is not liable for indirect or consequential losses
          arising from your use of the service. Our total liability for any claim is limited to the amount you
          paid for the affected booking.
        </p>
      </PolicySection>

      <PolicySection title="9. Changes to these terms">
        <p>
          We may update these terms from time to time. Material changes will be announced on the site. Continued
          use of PulseSeat after changes take effect constitutes acceptance.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
