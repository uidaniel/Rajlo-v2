import { LegalPage } from "@/components/legal-page";

/**
 * Terms of Service — covers the rideshare platform contract between
 * Rajlo Limited, riders, and drivers. References Jamaica Transport
 * Authority requirements and provides arbitration-style dispute
 * resolution. Should be reviewed by a Jamaica-licensed attorney
 * before public launch.
 */
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="May 2026">
      <p className="text-muted">
        These Terms of Service (&quot;Terms&quot;) form a binding agreement between you and
        Rajlo Limited (&quot;Rajlo&quot;, &quot;we&quot;, &quot;us&quot;), a company registered
        in Jamaica. They govern your access to the Rajlo platform — including our website, app,
        wallet, and any related services — whether you use them as a rider, a driver, or both.
      </p>
      <p className="mt-3 text-muted">
        By creating an account or using Rajlo, you confirm that you have read, understood, and
        agreed to these Terms and our{" "}
        <a href="/legal/privacy" className="font-semibold text-rajlo-red">
          Privacy Policy
        </a>
        . If you do not agree, do not use the service.
      </p>

      <h2 className="mt-10 text-2xl font-extrabold tracking-tight">1. What Rajlo is</h2>
      <p className="mt-3 text-muted">
        Rajlo is a technology platform that connects riders looking for a ride with independent,
        red-plate, Transport Authority of Jamaica (TA)–licensed drivers operating their own
        vehicles. We support two ride modes:
      </p>
      <ul className="mt-3 space-y-2 text-muted">
        <li>
          • <strong>Private Ride (Mode A)</strong> — a door-to-door ride for one rider or group,
          on a route the rider chooses. Fares are calculated by the platform.
        </li>
        <li>
          • <strong>Route Taxi (Mode B)</strong> — a TA-regulated corridor service. Fares
          follow the published Transport Authority schedule.
        </li>
      </ul>
      <p className="mt-3 text-muted">
        Rajlo does <strong>not</strong> own or operate vehicles, employ drivers, or directly
        provide transportation services. Drivers are independent operators responsible for
        their own vehicles, licences, and compliance.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">2. Eligibility</h2>
      <p className="mt-3 text-muted">
        Riders must be at least eighteen (18) years old, or accompanied by a parent or legal
        guardian who is a Rajlo account holder. Drivers must be at least twenty-one (21) years
        old.
      </p>
      <p className="mt-3 text-muted">
        Drivers must, before accepting any ride on Rajlo, hold and maintain in good standing:
      </p>
      <ul className="mt-3 space-y-2 text-muted">
        <li>• A current Transport Authority Franchise Certificate for public passenger vehicle (PPV) service.</li>
        <li>• A valid PPV-class Jamaican driver&apos;s licence.</li>
        <li>• A vehicle registered as a red-plate PPV with current road licence and certificate of fitness.</li>
        <li>• Comprehensive PPV-class motor vehicle insurance.</li>
        <li>• A clean criminal record check, refreshed annually.</li>
      </ul>
      <p className="mt-3 text-muted">
        Drivers authorise Rajlo to verify each of these documents and to suspend the
        driver&apos;s account immediately if any document expires or is found to be invalid.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">3. Your account</h2>
      <p className="mt-3 text-muted">
        You agree to provide accurate information when you register and to keep it up to date.
        You are responsible for the activity on your account. Keep your password and device
        secure. Notify us at <strong>support@rajlo.com</strong> if you believe your account has
        been accessed without your authorisation.
      </p>
      <p className="mt-3 text-muted">
        We may suspend or terminate accounts that violate these Terms, that pose a safety or
        regulatory risk, or that engage in fraud.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">4. The Rajlo wallet</h2>
      <p className="mt-3 text-muted">
        Rajlo is a fully cashless platform. Riders pay for trips and drivers receive earnings
        through the Rajlo wallet — an electronic balance recorded in our system. Trips cannot
        be paid for in cash.
      </p>
      <ul className="mt-3 space-y-2 text-muted">
        <li>
          • <strong>Top-ups</strong> — riders add funds via the bank or payment provider
          options shown in the app.
        </li>
        <li>
          • <strong>Trip payment</strong> — when a trip ends, the rider&apos;s wallet is debited
          for the fare and the driver&apos;s wallet is credited with the driver&apos;s share
          (currently 85% of the fare). Rajlo retains the remaining commission to operate the
          platform.
        </li>
        <li>
          • <strong>Driver withdrawals</strong> — drivers may withdraw their balance to a
          Jamaican bank account. Withdrawals are subject to a minimum amount and a review
          window to confirm bank details. Funds typically arrive within one to three business
          days after approval.
        </li>
        <li>
          • <strong>Rider-to-rider transfer</strong> — riders may send wallet funds to other
          riders, confirmed by a one-time code sent to the sender&apos;s email.
        </li>
        <li>
          • <strong>Disputes</strong> — if you believe a wallet transaction is in error, contact{" "}
          <strong>support@rajlo.com</strong> within thirty (30) days. We will investigate and,
          where appropriate, adjust your balance.
        </li>
      </ul>
      <p className="mt-3 text-muted">
        Wallet balances are not deposit accounts and do not earn interest. Wallet balances may
        be paid out to your registered bank account on closure of your account, subject to any
        amounts due to Rajlo or required to be withheld by law.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">5. Fares</h2>
      <p className="mt-3 text-muted">
        <strong>Private Ride.</strong> The fare is shown in the rider&apos;s app before the
        rider confirms the trip. It is based on estimated distance, time, intermediate stops,
        and seat count. The final fare may adjust at the end of the trip to reflect the actual
        route driven; the rider will see the final fare on the trip receipt.
      </p>
      <p className="mt-3 text-muted">
        <strong>Route Taxi.</strong> The fare follows the schedule published by the Transport
        Authority of Jamaica (most recently revised October 2023, available at the TA office or
        at the link in our public fare estimator). It is calculated as a base rate plus a
        per-kilometre rate, rounded to the nearest ten Jamaican dollars. Rajlo does not add
        surcharges on top of the TA-published rate, except where explicitly disclosed in the
        app.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">6. Cancellations and no-shows</h2>
      <p className="mt-3 text-muted">
        Riders may cancel a Private Ride at no charge before the driver accepts. Once the
        driver has accepted and is on the way, a cancellation fee may apply to compensate the
        driver for their time and distance. The fee, if any, will be disclosed in-app before
        the cancellation is confirmed.
      </p>
      <p className="mt-3 text-muted">
        If a rider does not appear at the pickup location within a reasonable time (typically
        five minutes after the driver arrives), the driver may mark the trip as a no-show. A
        no-show fee may apply.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">7. Conduct</h2>
      <p className="mt-3 text-muted">
        Riders and drivers agree to:
      </p>
      <ul className="mt-3 space-y-2 text-muted">
        <li>• Treat each other with respect.</li>
        <li>• Comply with all Jamaican laws, including traffic and PPV regulations.</li>
        <li>
          • Refrain from harassment, threats, hateful conduct, sexual misconduct, possession or
          use of illegal substances during a trip, or any unsafe behaviour.
        </li>
        <li>• Wear seatbelts.</li>
        <li>• Not damage the vehicle or property of other users.</li>
      </ul>
      <p className="mt-3 text-muted">
        Rajlo may suspend or permanently ban any account that breaches these standards. Serious
        conduct will be reported to law enforcement.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">8. Safety</h2>
      <p className="mt-3 text-muted">
        Rajlo provides in-app safety features including live trip tracking, masked rider-driver
        chat, an SOS button connected to our safety operations team, and the ability to share
        your live trip with a chosen contact. These tools complement, but do not replace,
        emergency services. In any genuine emergency, contact <strong>119</strong> (Jamaica
        Constabulary Force) or <strong>110</strong> (Fire Brigade) directly.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">9. Disclaimers and liability</h2>
      <p className="mt-3 text-muted">
        Rajlo provides the platform &quot;as is&quot;. While we work to keep it reliable and
        secure, we do not warrant uninterrupted service. Drivers are independent contractors,
        not Rajlo employees; Rajlo is not responsible for the conduct of a driver or rider
        beyond what we can reasonably control through verification and platform tools.
      </p>
      <p className="mt-3 text-muted">
        To the maximum extent permitted by law, Rajlo&apos;s total liability to you for any
        claim arising out of or related to these Terms or your use of Rajlo is limited to the
        greater of (a) the total amount you paid to Rajlo in the three months preceding the
        claim, or (b) JMD 25,000. Nothing in these Terms limits liability that cannot be
        excluded under Jamaican law (for example, liability for death or personal injury caused
        by negligence).
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">10. Indemnity</h2>
      <p className="mt-3 text-muted">
        You agree to indemnify and hold Rajlo harmless against any claim, loss, or expense
        arising from your breach of these Terms, your violation of any law, or your infringement
        of any third party&apos;s rights.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">11. Disputes and governing law</h2>
      <p className="mt-3 text-muted">
        These Terms are governed by the laws of Jamaica. You and Rajlo agree to first attempt
        to resolve any dispute informally by contacting <strong>support@rajlo.com</strong>. If
        we cannot resolve the dispute within thirty (30) days, either party may submit the
        dispute to mediation in Kingston, Jamaica. If mediation does not resolve the dispute,
        the dispute will be referred to arbitration under the Jamaica Arbitration Act, before a
        single arbitrator appointed by agreement or, failing agreement, by the Chairman of the
        Dispute Resolution Foundation of Jamaica.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">12. Changes to these Terms</h2>
      <p className="mt-3 text-muted">
        We may update these Terms as the service evolves. Material changes will be highlighted
        in-app and emailed to active users at least thirty (30) days before they take effect.
        Continued use of Rajlo after that date constitutes acceptance of the revised Terms.
      </p>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">13. Contact</h2>
      <p className="mt-3 text-muted">
        Rajlo Limited
        <br />
        Kingston, Jamaica
        <br />
        General: <strong>support@rajlo.com</strong>
        <br />
        Privacy: <strong>privacy@rajlo.com</strong>
        <br />
        Safety: <strong>safety@rajlo.com</strong>
      </p>

      <p className="mt-10 rounded-2xl border border-rajlo-red/30 bg-rajlo-red/5 p-5 text-sm text-muted">
        <strong>Beta notice.</strong> These Terms were drafted in plain language for a public
        beta. They will be reviewed by Jamaica-licensed counsel before general public launch and
        may change as a result. Material changes will be communicated in advance.
      </p>
    </LegalPage>
  );
}
