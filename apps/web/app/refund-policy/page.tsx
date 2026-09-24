import { PolicyLayout, PolicySection } from '@/components/layout/policy-layout';

export const metadata = {
  title: 'Refund Policy — PulseSeat',
  description: 'When and how PulseSeat issues refunds for cancelled or rescheduled events.',
};

export default function RefundPolicyPage() {
  return (
    <PolicyLayout
      icon="refund"
      title="Refund Policy"
      updated="September 2026"
      intro="When and how refunds work for cancelled or rescheduled events booked through PulseSeat."
    >
      <PolicySection title="1. Cancellation eligibility">
        <p>
          Each event listing shows its cancellation window. Where cancellation is allowed, you can cancel from
          My Bookings until the cutoff shown at the time of purchase. After the cutoff, tickets are
          non-cancellable.
        </p>
      </PolicySection>

      <PolicySection title="2. Refund conditions">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-dark-300">100% refund</strong> — cancelled at least 7 days before the event</li>
          <li><strong className="text-dark-300">50% refund</strong> — cancelled between 3 and 7 days before the event</li>
          <li><strong className="text-dark-300">No refund</strong> — cancelled within 3 days of the event</li>
        </ul>
        <p>The convenience fee is non-refundable in all cases.</p>
      </PolicySection>

      <PolicySection title="3. Event cancelled by the organizer">
        <p>
          If the organizer cancels an event entirely, you receive a full refund of the ticket price to your
          original payment method — no action needed. Refunds are initiated automatically.
        </p>
      </PolicySection>

      <PolicySection title="4. Event rescheduled">
        <p>
          For rescheduled events, your tickets remain valid for the new date. If the new date does not work for
          you, you can request a full refund within 7 days of the reschedule announcement.
        </p>
      </PolicySection>

      <PolicySection title="5. Processing timelines">
        <p>
          Approved refunds are initiated within 5–7 business days. Depending on your bank or card issuer, it may
          take an additional 5–10 business days for the amount to reflect in your account.
        </p>
      </PolicySection>

      <PolicySection title="6. Non-refundable situations">
        <ul className="list-disc pl-5 space-y-1">
          <li>Change of mind after the cancellation window has passed</li>
          <li>Partial attendance — arriving late or leaving early</li>
          <li>Unfavourable weather for open-air events that proceed as scheduled</li>
          <li>Convenience fees and add-ons already consumed</li>
        </ul>
      </PolicySection>

      <PolicySection title="7. How to request a refund">
        <p>
          Go to My Bookings, open the booking, and choose Cancel &amp; Refund if eligible. For anything else,
          contact support with your booking reference and we&apos;ll help you out.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
