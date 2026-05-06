import { LegalPage } from "@/components/legal-page";

export default function SafetyPage() {
  return (
    <LegalPage title="Safety at Rajlo" lastUpdated="May 2026">
      <p className="text-muted">
        Safety is one of our four core brand pillars. Every Rajlo ride is built around a robust trust
        framework — passenger safety, driver training, and transparent pricing.
      </p>

      <h2 className="mt-10 text-2xl font-extrabold tracking-tight">Driver vetting</h2>
      <ul className="mt-3 space-y-2 text-muted">
        <li>• TA Franchise Certificate verified at onboarding and annually.</li>
        <li>• Police Record / Good Conduct Certificate at initial application.</li>
        <li>• Selfie matched to driver&apos;s licence and TA Driver Badge.</li>
        <li>• Comprehensive PPV insurance verified before activation.</li>
        <li>• Annual re-verification — accounts auto-suspend on document expiry.</li>
      </ul>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">In-trip safety</h2>
      <ul className="mt-3 space-y-2 text-muted">
        <li>• Live GPS tracking shared with you at all times during a trip.</li>
        <li>• Share trip status with a trusted contact in one tap.</li>
        <li>• In-app SOS button connects you to emergency support.</li>
        <li>• Anonymous in-app messaging — driver and rider phone numbers are never exchanged.</li>
      </ul>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">Reporting an incident</h2>
      <p className="mt-3 text-muted">
        If something goes wrong, report it from your trip history or via the Support screen. Rajlo
        investigates every report and may suspend an account pending review.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">Emergency</h2>
      <p className="mt-3 text-muted">
        In a life-threatening situation, call <strong>119</strong> (Police) or <strong>110</strong> (Fire & Ambulance) immediately. You can use the
        in-app SOS button to share your live location with our team and your trusted contacts.
      </p>

      <p className="mt-10 rounded-2xl border border-line bg-surface-soft p-5 text-sm text-muted">
        Placeholder content. Final safety procedures will be reviewed in coordination with the
        Transport Authority before public launch.
      </p>
    </LegalPage>
  );
}
