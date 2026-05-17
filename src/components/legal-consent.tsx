"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./icons";

/** Minimal document shape the consent block renders. Both the full
 *  registry `LegalDocument` and the trimmed wire objects returned by
 *  /api/legal/status satisfy this. */
export type ConsentDocument = {
  key: string;
  title: string;
  summary: string;
};

/**
 * Legal consent block — the shared, legally load-bearing UI shown at
 * signup and on the re-acceptance gate.
 *
 * Layout is "compact + expandable": the explicit consent checkbox sits
 * at the TOP so it's reachable without scrolling, and the full policy
 * list + the GPS / payment / OTP disclosures live behind a single
 * expander. Nothing is removed — every policy link and every
 * plain-language disclosure is still one tap away — but the user is no
 * longer forced to scroll a wall of text before they can agree.
 *
 * Consent remains enforceable because:
 *   1. The checkbox copy itself names what's being agreed to and that
 *      the acceptance is recorded.
 *   2. Every policy is a real link to its full text at `/legal/<key>`.
 *   3. The three high-impact consents (background GPS, automatic
 *      payments, OTP) are stated verbatim in the expander.
 *   4. The parent blocks submission until the box is ticked, and the
 *      acceptance is logged server-side with version + timestamp + IP
 *      via POST /api/legal/accept.
 */

type Disclosure = {
  icon: IconName;
  title: string;
  body: string;
};

/** The three plain-language disclosures shown as callouts. Worded to
 *  mirror the Privacy Policy, Payment & Refund Policy, and the OTP /
 *  account-security language in the Terms. */
const DISCLOSURES: Disclosure[] = [
  {
    icon: "map-pin",
    title: "Location & background GPS",
    body: "RAJLO collects your real-time GPS location — including while the app runs in the background — to match trips, navigate, improve pickup accuracy, and detect fraud. You can change location permissions in your device settings, but core features may stop working.",
  },
  {
    icon: "credit-card",
    title: "Automatic payments",
    body: "RAJLO is fully cashless. You authorize RAJLO and its payment processors to automatically charge your payment method or wallet for trip fares, cancellation fees, no-show fees, cleaning or damage fees, and any outstanding balances — without asking again at the time of each charge.",
  },
  {
    icon: "shield-check",
    title: "OTP verification",
    body: "You consent to receive one-time verification codes (OTP) by SMS or email to secure your account. You agree to keep these codes confidential and accept responsibility for activity authorized with them.",
  },
];

export function LegalConsent({
  documents,
  checked,
  onChange,
  /** Heading copy — differs between signup and the re-acceptance gate. */
  heading = "Before you continue",
  intro = "Creating a RAJLO account means agreeing to the policies below. Tap any policy to read it in full.",
}: {
  documents: ConsentDocument[];
  checked: boolean;
  onChange: (next: boolean) => void;
  heading?: string;
  intro?: string;
}) {
  const [open, setOpen] = useState(false);
  const count = documents.length;

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-rajlo-red">
        {heading}
      </p>

      {/* The explicit consent checkbox — kept at the top so it's
          reachable without scrolling past the policy detail. */}
      <label className="mt-2.5 flex cursor-pointer items-start gap-3 rounded-xl border border-rajlo-red/30 bg-primary-soft/40 p-3 sm:p-3.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-line accent-rajlo-red focus:ring-2 focus:ring-rajlo-red/20"
        />
        <span className="min-w-0 text-xs font-semibold leading-relaxed">
          I have read, understood, and agree to be legally bound by RAJLO&apos;s{" "}
          {count} {count === 1 ? "policy" : "policies"} — and I consent to
          background GPS location, automatic wallet charges, OTP verification,
          and to RAJLO recording this acceptance.
        </span>
      </label>

      {/* Single expander revealing the full policy list + disclosures. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-2.5 flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-background px-3.5 py-2.5 text-left transition-colors hover:border-rajlo-red"
      >
        <span className="min-w-0 text-xs font-bold">
          {open ? "Hide" : "Review"} the {count}{" "}
          {count === 1 ? "policy" : "policies"} &amp; key disclosures
        </span>
        <Icon
          name="chevron-down"
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <p className="text-[11px] leading-relaxed text-muted">{intro}</p>

          {/* Policy list */}
          <ul className="space-y-1.5">
            {documents.map((doc) => (
              <li key={doc.key}>
                <Link
                  href={`/legal/${doc.key}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-background px-3.5 py-2.5 transition-colors hover:border-rajlo-red"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {doc.title}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {doc.summary}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                    Read
                    <Icon name="arrow-right" className="h-3 w-3" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* High-impact disclosures */}
          <div className="space-y-2.5">
            {DISCLOSURES.map((d) => (
              <div
                key={d.title}
                className="flex gap-3 rounded-xl bg-background p-3 sm:p-3.5"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rajlo-red/10 text-rajlo-red">
                  <Icon name={d.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold">{d.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                    {d.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
