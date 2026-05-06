import { LegalPage } from "@/components/legal-page";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="May 2026">
      <p className="text-muted">
        These Terms of Service govern your access to and use of Rajlo&apos;s rideshare platform in Jamaica.
        By creating an account or using the service, you agree to these Terms.
      </p>

      <h2 className="mt-10 text-2xl font-extrabold tracking-tight">1. Eligibility</h2>
      <p className="mt-3 text-muted">
        Riders must be at least 18 years old or accompanied by a legal guardian. Drivers must hold a
        current TA Franchise Certificate, valid PPV-class driver&apos;s licence, and comprehensive PPV
        insurance.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">2. Driver requirements</h2>
      <p className="mt-3 text-muted">
        Rajlo is a red-plate-only platform. All drivers must complete TA verification before activation
        and re-verify annually. Rajlo reserves the right to suspend any driver whose documents have
        expired.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">3. Fares and payments</h2>
      <p className="mt-3 text-muted">
        Fares are computed using parish-based rules and shown before each booking. Riders authorize
        Rajlo to charge their selected payment method at the end of each trip.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">4. Cancellations</h2>
      <p className="mt-3 text-muted">
        Riders may cancel before driver acceptance at no charge. After acceptance, a small cancellation
        fee may apply depending on driver distance.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">5. Conduct</h2>
      <p className="mt-3 text-muted">
        Riders and drivers agree to conduct themselves respectfully and lawfully. Rajlo prohibits
        harassment, discrimination, or unsafe behaviour and may suspend accounts that violate these
        rules.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">6. Disclaimers</h2>
      <p className="mt-3 text-muted">
        Rajlo provides a platform connecting riders to verified drivers. We do not employ drivers and
        we are not liable for losses or damages outside of our reasonable control.
      </p>

      <p className="mt-10 rounded-2xl border border-line bg-surface-soft p-5 text-sm text-muted">
        Placeholder content. Final Terms will be drafted in consultation with Jamaica counsel before
        public launch.
      </p>
    </LegalPage>
  );
}
