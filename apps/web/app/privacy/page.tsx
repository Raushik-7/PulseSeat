import { PolicyLayout, PolicySection } from '@/components/layout/policy-layout';

export const metadata = {
  title: 'Privacy Policy — PulseSeat',
  description: 'How PulseSeat collects, uses, and protects your information.',
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyLayout
      icon="privacy"
      title="Privacy Policy"
      updated="September 2026"
      intro="How PulseSeat collects, uses, and protects your information when you discover and book events."
    >
      <PolicySection title="1. Information we collect">
        <p>
          When you create an account or book tickets, we collect your name, email address, and booking details
          (events booked, seats selected, payment status). We also collect technical information such as browser
          type and pages visited to keep the service running smoothly.
        </p>
      </PolicySection>

      <PolicySection title="2. How we use your information">
        <ul className="list-disc pl-5 space-y-1">
          <li>To create and manage your account</li>
          <li>To process bookings and hold your selected seats during checkout</li>
          <li>To send transactional messages such as OTP codes, booking confirmations, and event reminders</li>
          <li>To prevent fraud and enforce seat-inventory integrity</li>
          <li>To improve search, recommendations, and overall product experience</li>
        </ul>
      </PolicySection>

      <PolicySection title="3. Cookies and local storage">
        <p>
          We use browser local storage to keep you signed in and remember your preferences, and cookies for
          essential site functionality. We do not use advertising trackers.
        </p>
      </PolicySection>

      <PolicySection title="4. Payments">
        <p>
          Payments are processed by our payment provider. Card details are entered directly into the
          provider&apos;s secure, PCI-compliant flow — PulseSeat never stores your full card number or CVC.
        </p>
      </PolicySection>

      <PolicySection title="5. Data security">
        <p>
          We protect your data with encryption in transit, hashed credentials, scoped access controls, and audit
          logging of sensitive actions. No system is perfectly secure, but we design defensively at every layer.
        </p>
      </PolicySection>

      <PolicySection title="6. Your rights">
        <p>
          You can access and update your profile information at any time from the Profile page, and request
          deletion of your account by contacting support. We will action verified requests within 30 days.
        </p>
      </PolicySection>

      <PolicySection title="7. Data retention">
        <p>
          Booking records are retained for accounting and dispute-resolution purposes. OTP codes expire within
          minutes of being issued. You can request earlier deletion as described above.
        </p>
      </PolicySection>

      <PolicySection title="8. Contact">
        <p>
          For any privacy question or request, contact us at privacy@pulseseat.dev or via the contact page.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
