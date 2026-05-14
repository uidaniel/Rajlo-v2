"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Icon } from "./icons";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { clearSessionPolicy } from "@/lib/session-policy";

/**
 * Two-step account deletion dialog used by both the rider and driver
 * settings pages. Implements Google Play's account-deletion policy
 * (Article 4.1): in-app, prominent, reversible-only via support.
 *
 * UX:
 *   Step 1 — what will be deleted, what's retained, links to the
 *            privacy policy.
 *   Step 2 — type "DELETE" to confirm. Final tap calls the API,
 *            signs the user out, and bounces to a goodbye screen.
 *
 * Server rejects with 409 if there's an active trip — surface that
 * message inline so the user knows what to do.
 */

export function DeleteAccountDialog({
  open,
  role,
  onClose,
}: {
  open: boolean;
  role: "rider" | "driver";
  onClose: () => void;
}) {
  const [stage, setStage] = useState<"warn" | "confirm">("warn");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStage("warn");
    setTyped("");
    setBusy(false);
    setError(null);
  };

  const performDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(
          j.message ?? j.error ?? `Server returned ${res.status}`,
        );
      }
      // Server has wiped everything; clear the client session too
      // and bounce to a public page. Use a hard navigation so any
      // cached SWR / realtime channels die with the document.
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut().catch(() => null);
      clearSessionPolicy();
      window.location.href = "/?account_deleted=1";
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't delete your account.",
      );
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <m.div
          key="delete-account"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        >
          <m.div
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
        {/* Header */}
        <div className="bg-rajlo-red px-5 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Icon name="alert-triangle" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                Delete account
              </p>
              <h2
                id="delete-account-title"
                className="text-xl font-extrabold leading-tight"
              >
                {stage === "warn"
                  ? "This can't be undone."
                  : "Type DELETE to confirm"}
              </h2>
            </div>
          </div>
        </div>

        {/* Body */}
        {stage === "warn" ? (
          <div className="space-y-4 px-5 py-5">
            <p className="text-sm leading-relaxed text-foreground">
              Deleting your account permanently removes the data below
              from Rajlo. You won&apos;t be able to recover it — to come
              back you&apos;ll have to sign up fresh.
            </p>
            <ul className="space-y-2 rounded-2xl border border-line bg-surface-soft p-4 text-sm">
              <li className="flex items-start gap-2">
                <Icon
                  name="x"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rajlo-red"
                />
                <span>Your profile (name, phone, email, avatar)</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon
                  name="x"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rajlo-red"
                />
                <span>
                  {role === "rider"
                    ? "Your ride history, ratings, and trusted contacts"
                    : "Your driver record, uploaded TA documents, ratings, and earnings history"}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Icon
                  name="x"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rajlo-red"
                />
                <span>Your wallet balance and transaction history</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon
                  name="x"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rajlo-red"
                />
                <span>Your chat threads, voice notes, and image attachments</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon
                  name="x"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rajlo-red"
                />
                <span>Push subscriptions on every device you signed in on</span>
              </li>
            </ul>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-bold">A few things stay</p>
              <p className="mt-1 text-amber-900/85">
                The OTHER party on past trips keeps their ride record
                with you shown as &ldquo;Deleted user&rdquo;. Admin audit
                logs of any safety, verification, or wallet actions
                are retained for compliance — required by Jamaica&apos;s
                Bank of Jamaica + Transport Authority rules. See{" "}
                <a
                  href="/legal/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold underline"
                >
                  Privacy Policy
                </a>{" "}
                for the full retention schedule.
              </p>
            </div>

            {error && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  reset();
                  onClose();
                }}
                className="rounded-full px-6 py-3 text-sm font-semibold text-muted hover:text-foreground"
              >
                Keep my account
              </button>
              <button
                type="button"
                onClick={() => setStage("confirm")}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
              >
                Continue
                <Icon name="arrow-right" className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-5">
            <p className="text-sm leading-relaxed text-foreground">
              To confirm, type{" "}
              <span className="font-mono font-extrabold text-rajlo-red">
                DELETE
              </span>{" "}
              below. Capital letters only.
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-2xl border border-line bg-surface-soft px-4 py-3 font-mono text-base outline-none focus:border-rajlo-red"
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={busy}
            />

            {error && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setStage("warn");
                  setTyped("");
                  setError(null);
                }}
                disabled={busy}
                className="rounded-full px-6 py-3 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="button"
                onClick={performDelete}
                disabled={busy || typed !== "DELETE"}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Icon name="alert-triangle" className="h-4 w-4" />
                )}
                {busy ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </div>
        )}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
