"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Icon } from "./icons";

/**
 * Verify-Your-Ride PIN entry dialog for the driver. Opens when the
 * driver taps "Start trip" on a ride that has a PIN attached.
 *
 * Server is the source of truth for "right vs wrong" and for the
 * 3-strikes auto-cancel — this component just collects 4 digits,
 * POSTs them, and surfaces the response. If the server cancels the
 * ride on the 3rd strike (HTTP 423 with `cancelled: true`), we close
 * via `onCancelled` so the parent can transition to the post-cancel
 * UI.
 */

type VerifyResponse =
  | { ok: true; verified: true }
  | { error: string; remainingAttempts?: number; cancelled?: boolean };

export function PinEntryDialog({
  open,
  rideId,
  onClose,
  onVerified,
  onCancelled,
}: {
  open: boolean;
  rideId: string | null;
  onClose: () => void;
  /** Server accepted the PIN — parent should now fire the start
   *  transition. */
  onVerified: () => void;
  /** Server hit 3 strikes and cancelled the ride. Parent should bounce
   *  back to the dashboard / empty state. */
  onCancelled: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null,
  );
  const inputsRef = useRef<Array<HTMLInputElement | null>>([null, null, null, null]);

  // Reset every time the dialog opens so a re-open starts fresh.
  useEffect(() => {
    if (!open) return;
    setDigits(["", "", "", ""]);
    setError(null);
    setRemainingAttempts(null);
    setSubmitting(false);
    // Focus the first cell on the next paint so the keyboard pops up.
    const t = setTimeout(() => inputsRef.current[0]?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  const setDigit = (idx: number, raw: string) => {
    // Allow paste of the whole 4-digit code into the first cell.
    const cleaned = raw.replace(/\D+/g, "");
    if (cleaned.length === 0) {
      setDigits((prev) => {
        const next = [...prev];
        next[idx] = "";
        return next;
      });
      return;
    }
    if (cleaned.length >= 4) {
      const four = cleaned.slice(0, 4).split("");
      setDigits(four);
      inputsRef.current[3]?.focus();
      return;
    }
    // Single digit — set + advance.
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = cleaned[0];
      return next;
    });
    if (idx < 3) inputsRef.current[idx + 1]?.focus();
  };

  const handleKeyDown = (
    idx: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    if (!rideId) return;
    const pin = digits.join("");
    if (pin.length !== 4) {
      setError("Enter all 4 digits.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/driver/rides/${rideId}/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const body = (await res.json().catch(() => ({}))) as VerifyResponse;
      if (res.ok && "ok" in body && body.ok) {
        onVerified();
        return;
      }
      // Three-strikes cancel — bail out of the modal flow entirely.
      if ("cancelled" in body && body.cancelled) {
        onCancelled();
        return;
      }
      const remaining =
        "remainingAttempts" in body && typeof body.remainingAttempts === "number"
          ? body.remainingAttempts
          : null;
      setRemainingAttempts(remaining);
      setError(
        remaining != null
          ? `Wrong PIN. ${remaining} ${remaining === 1 ? "try" : "tries"} left.`
          : ("error" in body && typeof body.error === "string"
              ? body.error
              : "Wrong PIN."),
      );
      setDigits(["", "", "", ""]);
      inputsRef.current[0]?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <m.div
          key="pin-entry"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-entry-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          onClick={() => {
            if (!submitting) onClose();
          }}
        >
          <m.div
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-rajlo-red px-5 py-5 text-white">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                  <Icon name="shield-check" className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                    Verify-your-ride
                  </p>
                  <h2
                    id="pin-entry-title"
                    className="text-xl font-extrabold leading-tight"
                  >
                    Enter the rider&apos;s PIN
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/90">
                Ask your rider for their 4-digit PIN. They&apos;ll read it from
                their app. The trip starts as soon as the code matches.
              </p>
            </div>

            <div className="space-y-4 px-5 py-6">
              <div className="flex items-center justify-center gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputsRef.current[i] = el;
                    }}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={i === 0 ? 4 : 1}
                    value={digits[i]}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    aria-label={`PIN digit ${i + 1}`}
                    disabled={submitting}
                    className="h-16 w-14 rounded-2xl border-2 border-line bg-surface-soft text-center font-mono text-3xl font-extrabold tracking-tight outline-none focus:border-rajlo-red focus:bg-white"
                  />
                ))}
              </div>

              {error && (
                <p
                  className={`text-center text-sm font-semibold ${
                    remainingAttempts === 1
                      ? "text-rajlo-red"
                      : "text-rajlo-red"
                  }`}
                  role="alert"
                >
                  {error}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-line bg-surface-soft px-5 py-4 sm:flex-row-reverse">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || digits.join("").length !== 4}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Icon name="check-circle" className="h-4 w-4" />
                )}
                {submitting ? "Verifying…" : "Verify & start trip"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-full px-6 py-3 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-60 sm:flex-none"
              >
                Cancel
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
