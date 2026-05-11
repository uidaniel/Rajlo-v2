import { LegalPage } from "@/components/legal-page";

/**
 * Privacy Policy — drafted to align with Jamaica's Data Protection Act
 * 2020 (DPA) and the rideshare-specific data the platform actually
 * collects. Not a substitute for review by a Jamaica-licensed attorney
 * before public launch.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="May 2026">
      <p className="text-muted">
        Rajlo Limited (&quot;Rajlo&quot;, &quot;we&quot;, &quot;us&quot;) operates a cashless
        rideshare platform connecting riders to verified red-plate drivers in Jamaica. This
        Privacy Policy explains what personal data we collect when you use Rajlo, how we use it,
        who we share it with, and the rights you have over it under the Jamaica Data Protection
        Act, 2020 (DPA).
      </p>
      <p className="mt-3 text-muted">
        By creating a Rajlo account or using the Rajlo app, you consent to the practices
        described here.
      </p>

      <h2 className="mt-10 text-2xl font-extrabold tracking-tight">1. Who we are</h2>
      <p className="mt-3 text-muted">
        Rajlo Limited, a company registered in Jamaica, is the &quot;data controller&quot; for
        the personal data described in this Policy. For questions about this Policy or to
        exercise any right described below, contact us at{" "}
        <strong>privacy@rajlo.com</strong>.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">2. Data we collect</h2>
      <p className="mt-3 text-muted">
        We collect only what we need to run the platform. Categories:
      </p>
      <ul className="mt-3 space-y-2 text-muted">
        <li>
          • <strong>Account data</strong> — name, email, phone number, password (stored hashed),
          role (rider, driver, admin), profile photo.
        </li>
        <li>
          • <strong>Driver compliance data</strong> — TA Franchise Certificate, PPV driver&apos;s
          licence, insurance certificate, vehicle registration, road licence, fitness
          certificate, verification selfie. These documents are encrypted at rest in our
          storage provider and are only accessible to Rajlo verification staff and you.
        </li>
        <li>
          • <strong>Vehicle data</strong> — plate number, make, model, year, colour.
        </li>
        <li>
          • <strong>Trip data</strong> — pickup, dropoff and intermediate-stop addresses; route
          taken; distance; duration; seats; fare; rating and review text; in-trip chat between
          rider and driver.
        </li>
        <li>
          • <strong>Location data</strong> — your device&apos;s precise location while you have
          an active trip, and (for drivers) while you are toggled online. We do NOT track your
          location when no trip is active and the app is closed.
        </li>
        <li>
          • <strong>Wallet and payment data</strong> — wallet balance, top-up and transfer
          history, transaction amounts. We do not store full card numbers; payment card data is
          handled by our bank/payment provider directly.
        </li>
        <li>
          • <strong>Device and usage data</strong> — browser type, device model, IP address,
          push-notification subscription tokens, app interaction events (e.g. screens viewed,
          features used) — used to debug issues and improve the product.
        </li>
        <li>
          • <strong>Safety data</strong> — when you trigger the in-app SOS, we record the time,
          your location at that moment, the trip context, and a reference number we share with
          our safety operations team.
        </li>
      </ul>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">3. How we use your data</h2>
      <ul className="mt-3 space-y-2 text-muted">
        <li>
          • <strong>Matching</strong> — pair you with a suitable driver or rider, calculate
          fares, route trips.
        </li>
        <li>
          • <strong>Trip safety</strong> — provide live driver location to riders, send arrival
          and trip-completion notifications, support the SOS feature.
        </li>
        <li>
          • <strong>Regulatory compliance</strong> — verify driver eligibility against TA
          documents; respond to lawful requests from the Transport Authority of Jamaica or other
          government bodies.
        </li>
        <li>
          • <strong>Payments</strong> — debit your wallet for completed trips, credit driver
          earnings, process bank withdrawals.
        </li>
        <li>
          • <strong>Service improvement</strong> — identify bugs, measure feature performance,
          and refine the matching engine. Where possible we use anonymised or aggregated data.
        </li>
        <li>
          • <strong>Communications</strong> — send transactional emails (receipts, account
          alerts), in-app notifications, and push notifications. We may occasionally send
          product updates; you can unsubscribe at any time.
        </li>
      </ul>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">4. Legal basis for processing</h2>
      <p className="mt-3 text-muted">
        Under the DPA we rely on the following legal bases:
      </p>
      <ul className="mt-3 space-y-2 text-muted">
        <li>• <strong>Consent</strong> — for marketing communications and optional features.</li>
        <li>
          • <strong>Contract</strong> — to provide the rideshare service you signed up for.
        </li>
        <li>
          • <strong>Legal obligation</strong> — to keep records the Transport Authority, tax
          authorities, or law enforcement may require.
        </li>
        <li>
          • <strong>Legitimate interests</strong> — to keep the platform safe, prevent fraud,
          and improve the product. We balance these interests against your privacy rights.
        </li>
      </ul>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">5. Who we share data with</h2>
      <p className="mt-3 text-muted">
        We share the minimum necessary data with the following recipients, under written
        agreements that require them to protect it to the same standard we do:
      </p>
      <ul className="mt-3 space-y-2 text-muted">
        <li>
          • <strong>Other Rajlo users</strong> — drivers see the rider&apos;s first name, pickup
          and dropoff, and rating after the trip. Riders see the driver&apos;s name, vehicle
          details, plate, and rating. Phone numbers are masked through in-app messaging where
          possible.
        </li>
        <li>
          • <strong>Service providers</strong> — Supabase (database + storage), Resend (email),
          Google Maps (geocoding and routing), our bank / payment processor (top-ups and
          withdrawals).
        </li>
        <li>
          • <strong>Government and regulators</strong> — the Transport Authority of Jamaica,
          Tax Administration Jamaica, and law enforcement, where required by law or in response
          to a valid legal request.
        </li>
        <li>
          • <strong>Professional advisors</strong> — auditors, lawyers, and accountants under
          confidentiality obligations.
        </li>
        <li>
          • <strong>Successors</strong> — in the event of a sale, merger, or other corporate
          transaction, anonymised or contractually protected data may transfer to the
          successor entity. We will notify you of any material change in control.
        </li>
      </ul>
      <p className="mt-3 text-muted">
        We do <strong>not</strong> sell your personal data. We do not share it with advertisers.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">6. How long we keep it</h2>
      <p className="mt-3 text-muted">
        Retention varies by category:
      </p>
      <ul className="mt-3 space-y-2 text-muted">
        <li>• <strong>Account data</strong> — for as long as your account is active.</li>
        <li>
          • <strong>Trip records and wallet transactions</strong> — at least seven (7) years
          after the trip, to comply with Jamaica tax and accounting record-keeping requirements.
        </li>
        <li>
          • <strong>Driver compliance documents</strong> — for the duration of your
          authorisation plus seven (7) years.
        </li>
        <li>
          • <strong>Location data</strong> — precise location is retained for ninety (90) days
          then aggregated or deleted, except where it is part of an SOS or dispute investigation.
        </li>
        <li>
          • <strong>Marketing preferences and opt-outs</strong> — kept indefinitely so we honour
          your preferences if you return.
        </li>
      </ul>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">7. Your rights</h2>
      <p className="mt-3 text-muted">
        Under the Jamaica DPA, you have the right to:
      </p>
      <ul className="mt-3 space-y-2 text-muted">
        <li>• Access the personal data we hold about you.</li>
        <li>• Correct inaccurate or incomplete data.</li>
        <li>• Ask us to delete your data, subject to our retention obligations above.</li>
        <li>• Withdraw consent for processing that was based on consent.</li>
        <li>• Object to processing based on legitimate interests.</li>
        <li>• Receive a copy of your data in a portable, machine-readable format.</li>
        <li>
          • Lodge a complaint with the Office of the Information Commissioner of Jamaica if you
          believe we have mishandled your data.
        </li>
      </ul>
      <p className="mt-3 text-muted">
        Send requests to <strong>privacy@rajlo.com</strong>. We respond within thirty (30) days,
        in line with the DPA.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">8. Security</h2>
      <p className="mt-3 text-muted">
        We protect your data with TLS in transit, encryption at rest for sensitive documents,
        row-level database access controls, multi-factor authentication for administrators, and
        regular review of access logs. No system is perfectly secure; if a breach affects your
        data, we will notify you and the Office of the Information Commissioner as required by
        law.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">9. Children</h2>
      <p className="mt-3 text-muted">
        Rajlo is not directed at children under 18. We do not knowingly collect data from
        anyone under 18. If you believe a minor has registered, contact us and we will remove
        the account.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">10. International transfers</h2>
      <p className="mt-3 text-muted">
        Our service providers may process data outside of Jamaica (for example, Supabase hosts
        databases in the United States and Europe). Where this happens we ensure equivalent
        protections through contractual safeguards, in line with the DPA.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">11. Changes to this Policy</h2>
      <p className="mt-3 text-muted">
        We may update this Policy as the service evolves. Material changes will be highlighted
        in-app and emailed to active users. The &quot;Last updated&quot; date at the top of this
        page reflects the most recent revision.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">12. Contact</h2>
      <p className="mt-3 text-muted">
        Rajlo Limited
        <br />
        Kingston, Jamaica
        <br />
        Email: <strong>privacy@rajlo.com</strong>
      </p>

      <p className="mt-10 rounded-2xl border border-rajlo-red/30 bg-rajlo-red/5 p-5 text-sm text-muted">
        <strong>Beta notice.</strong> This Policy was drafted in plain language for a public
        beta. It will be reviewed by Jamaica-licensed counsel before general public launch and
        may change as a result. Material changes will be communicated in advance.
      </p>
    </LegalPage>
  );
}
