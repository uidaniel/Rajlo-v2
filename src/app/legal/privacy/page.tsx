import { LegalPage } from "@/components/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="May 2026">
      <p className="text-muted">
        Rajlo respects your privacy. This Policy describes the data we collect, how we use it, and
        the choices you have.
      </p>

      <h2 className="mt-10 text-2xl font-extrabold tracking-tight">Data we collect</h2>
      <ul className="mt-3 space-y-2 text-muted">
        <li>• Account info: name, email, phone, role.</li>
        <li>• Driver info: TA documents, plate number, vehicle details.</li>
        <li>• Trip info: pickup, dropoff, route, fare, ratings.</li>
        <li>• Device info: browser, device, location while a trip is active.</li>
      </ul>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">How we use it</h2>
      <ul className="mt-3 space-y-2 text-muted">
        <li>• Match riders with verified drivers.</li>
        <li>• Compute parish-based fares.</li>
        <li>• Send trip notifications and receipts.</li>
        <li>• Maintain compliance with the Jamaica Transport Authority.</li>
      </ul>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">Sharing</h2>
      <p className="mt-3 text-muted">
        We share trip data with drivers and riders only to the extent needed to complete a trip.
        We may share anonymized usage data with service providers (e.g. SMS, payments).
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">Your choices</h2>
      <p className="mt-3 text-muted">
        You can request a copy of your data, correct it, or delete your account at any time. Some
        records (e.g. trip receipts) may be retained for tax or regulatory reasons.
      </p>

      <p className="mt-10 rounded-2xl border border-line bg-surface-soft p-5 text-sm text-muted">
        Placeholder content. Final Privacy Policy will be drafted with Jamaica counsel before launch.
      </p>
    </LegalPage>
  );
}
