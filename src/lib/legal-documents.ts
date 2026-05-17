/**
 * RAJLO legal document registry — the single source of truth for every
 * policy the platform enforces consent on.
 *
 * Why a code constant (not a DB table): the document TEXT lives in the
 * repo (`policies/*.txt`, rendered at `/legal/[slug]`), versions bump
 * via deploy, and consent enforcement keys off this list. Keeping the
 * registry in code means the version a user accepted is pinned to a
 * specific commit — auditable and immutable. The DB only stores the
 * acceptance EVENTS (`legal_acceptances`).
 *
 * To publish an updated policy:
 *   1. Edit the text in `policies/<slug>.txt`
 *   2. Bump that document's `version` here (e.g. "1.0" → "1.1")
 *   3. Update `effectiveDate`
 * Every user the document applies to will be forced to re-accept on
 * their next entry to the portal (see lib/legal-consent.ts).
 */

/** Who a policy binds. `everyone` = every rider AND driver must accept. */
export type LegalAudience = "everyone" | "rider" | "driver";

export type LegalDocument = {
  /** Stable identifier — also the URL slug (`/legal/<key>`) and the
   *  filename stem in `policies/`. Never change a key once shipped;
   *  acceptance rows reference it. */
  key: string;
  /** Human title shown in headers, the consent list, and the index. */
  title: string;
  /** Bump to force re-acceptance. Compared exactly against the
   *  `version` stored on each `legal_acceptances` row. */
  version: string;
  /** ISO date the current version takes effect. */
  effectiveDate: string;
  /** Which users must accept this document. */
  audience: LegalAudience;
  /** One-line plain-language summary for the consent screen + index. */
  summary: string;
};

/**
 * All 11 RAJLO policies. Audience was derived from each document's own
 * stated scope ("riders agree…", "drivers acknowledge…", "all users…").
 */
export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    key: "terms-of-service",
    title: "Terms of Service",
    version: "1.0",
    effectiveDate: "2026-05-17",
    audience: "everyone",
    summary:
      "The master agreement governing all use of the RAJLO platform.",
  },
  {
    key: "privacy-policy",
    title: "Privacy Policy",
    version: "1.0",
    effectiveDate: "2026-05-17",
    audience: "everyone",
    summary:
      "How RAJLO collects, uses, and protects your data — including GPS and background location.",
  },
  {
    key: "payment-refund-policy",
    title: "Payment & Refund Policy",
    version: "1.0",
    effectiveDate: "2026-05-17",
    audience: "everyone",
    summary:
      "Cashless payments, automatic charges, cancellation fees, refunds, and payouts.",
  },
  {
    key: "community-guidelines",
    title: "Community Guidelines",
    version: "1.0",
    effectiveDate: "2026-05-17",
    audience: "everyone",
    summary:
      "The conduct standards every rider and driver must follow on the platform.",
  },
  {
    key: "safety-disclaimer-emergency-policy",
    title: "Safety Disclaimer & Emergency Policy",
    version: "1.0",
    effectiveDate: "2026-05-17",
    audience: "everyone",
    summary:
      "Safety responsibilities, emergency procedures, and assumption of transportation risk.",
  },
  {
    key: "acceptable-use-policy",
    title: "Acceptable Use Policy",
    version: "1.0",
    effectiveDate: "2026-05-17",
    audience: "everyone",
    summary:
      "Permitted and prohibited use of the platform, APIs, and systems.",
  },
  {
    key: "website-app-disclaimer",
    title: "Website & App Disclaimer",
    version: "1.0",
    effectiveDate: "2026-05-17",
    audience: "everyone",
    summary:
      "Disclaimers covering platform accuracy, availability, and the technology-only nature of RAJLO.",
  },
  {
    key: "rider-cancellation-conduct-liability",
    title: "Rider Cancellation, Conduct & Liability Policy",
    version: "1.0",
    effectiveDate: "2026-05-17",
    audience: "rider",
    summary:
      "Rider cancellation fees, conduct standards, and liability for vehicle damage.",
  },
  {
    key: "driver-cancellation-service-reliability",
    title: "Driver Cancellation & Service Reliability Policy",
    version: "1.0",
    effectiveDate: "2026-05-17",
    audience: "driver",
    summary:
      "Driver cancellation rules, pickup standards, and service reliability expectations.",
  },
  {
    key: "driver-agreement",
    title: "Driver Agreement",
    version: "1.0",
    effectiveDate: "2026-05-17",
    audience: "driver",
    summary:
      "The independent-contractor agreement between RAJLO and each driver.",
  },
  {
    key: "driver-earnings-disclaimer",
    title: "Driver Earnings Disclaimer & Independent Income Disclosure",
    version: "1.0",
    effectiveDate: "2026-05-17",
    audience: "driver",
    summary:
      "Earnings are not guaranteed — variability, expenses, and independent-income disclosure.",
  },
];

/** A user role for the purpose of legal consent. Admins/officers are
 *  internal staff and aren't gated by the rider/driver consent flow. */
export type LegalRole = "rider" | "driver";

/** The ordered set of documents a given role must accept. `everyone`
 *  documents come first (the master agreements), then the
 *  role-specific ones. */
export function documentsForRole(role: LegalRole): LegalDocument[] {
  return LEGAL_DOCUMENTS.filter(
    (doc) => doc.audience === "everyone" || doc.audience === role,
  );
}

/** Look up one document by its key/slug. */
export function getLegalDocument(key: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((doc) => doc.key === key);
}

/** Every key/slug — used by generateStaticParams on the legal route. */
export const LEGAL_DOCUMENT_KEYS = LEGAL_DOCUMENTS.map((doc) => doc.key);

/** A compact "key@version" fingerprint for a role's full required set.
 *  Handy for a single-column "what did this user agree to" audit value. */
export function consentFingerprint(role: LegalRole): string {
  return documentsForRole(role)
    .map((doc) => `${doc.key}@${doc.version}`)
    .join(",");
}
