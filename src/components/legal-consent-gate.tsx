"use client";

import { useEffect, useState } from "react";
import { LegalConsent, type ConsentDocument } from "./legal-consent";

/**
 * Legal consent gate — a blocking overlay that catches any signed-in
 * rider or driver who owes a policy acceptance.
 *
 * It covers two cases with one mechanism:
 *   1. A brand-new account that hasn't recorded consent yet (every
 *      required policy is outstanding).
 *   2. A returning user after a policy was republished at a new
 *      version — only the changed policies are outstanding.
 *
 * Mounted in the rider and driver portal layouts. On mount it calls
 * GET /api/legal/status; if anything is outstanding it renders a
 * full-screen modal the user cannot dismiss without accepting. The
 * acceptance is logged via POST /api/legal/accept (version + timestamp
 * + IP captured server-side).
 *
 * This is the UI half of enforcement; the API routes (driver online,
 * rider trip request) enforce the same gate server-side so it can't be
 * bypassed by closing the modal with devtools.
 */
export function LegalConsentGate() {
  const [outstanding, setOutstanding] = useState<ConsentDocument[] | null>(
    null,
  );
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/legal/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { outstanding?: ConsentDocument[] } | null) => {
        if (cancelled || !json) return;
        if (Array.isArray(json.outstanding) && json.outstanding.length > 0) {
          setOutstanding(json.outstanding);
        }
      })
      .catch(() => {
        /* offline / not signed in — render nothing, the API gates
           still enforce server-side */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!outstanding || outstanding.length === 0) return null;

  const handleAccept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keys: outstanding.map((d) => d.key),
          context: "reacceptance",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Consent recorded — dismiss the gate.
      setOutstanding(null);
    } catch {
      setError(
        "Couldn't record your acceptance. Check your connection and try again.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-rajlo-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-background shadow-2xl">
        <div className="border-b border-line px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rajlo-red">
            Action required
          </p>
          <h2 className="mt-1 text-lg font-extrabold tracking-tight">
            Review &amp; accept to continue
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <LegalConsent
            documents={outstanding}
            checked={checked}
            onChange={setChecked}
            heading="Updated policies"
            intro="RAJLO has published new or updated policies. Please review and accept them to keep using your account."
          />
          {error && (
            <p className="mt-3 text-xs font-semibold text-rajlo-red">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-line p-4">
          <button
            type="button"
            disabled={!checked || submitting}
            onClick={handleAccept}
            className="inline-flex w-full items-center justify-center rounded-full bg-rajlo-red px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {submitting ? "Recording…" : "Agree & continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
