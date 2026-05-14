"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Icon } from "./icons";

/**
 * Reusable cancel-with-reason dialog. Replaces the browser `confirm()`
 * pattern used by the rider's live-trip cancel button and the driver's
 * active-trip cancel button.
 *
 * Offers a short list of pre-written reasons (calibrated to each role's
 * realistic motives) plus an "Other" option with free text. The
 * selected reason flows back through `onConfirm` as a string the caller
 * forwards to the cancel API — both endpoints already accept
 * `{ reason }` in the body, so no server changes needed.
 *
 * Empty / no reason is permitted (rider taps "Cancel anyway" without
 * picking) — the cancel still goes through, just with a null reason.
 */

export type CancelReasonRole = "rider" | "driver";

const RIDER_REASONS = [
  "Driver is taking too long",
  "Plans changed",
  "Picked the wrong destination",
  "Driver isn't responding",
  "Fare doesn't match the estimate",
] as const;

const DRIVER_REASONS = [
  "Rider isn't at the pickup",
  "Rider's phone is off / unreachable",
  "Rider asked me to cancel",
  "Vehicle issue (won't start, flat, etc.)",
  "Safety concern with this trip",
] as const;

export function CancelReasonDialog({
  open,
  role,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  role: CancelReasonRole;
  busy: boolean;
  onClose: () => void;
  /** Called with the final reason string (may be empty if user skipped
   *  picking). The caller's job to fire the cancel API and close. */
  onConfirm: (reason: string) => void;
}) {
  const presets = role === "rider" ? RIDER_REASONS : DRIVER_REASONS;
  const [selected, setSelected] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [showOther, setShowOther] = useState(false);

  const finalReason = showOther ? otherText.trim() : (selected ?? "");
  const canSubmit = !busy && (selected !== null || (showOther && otherText.trim().length > 0));

  return (
    <AnimatePresence>
      {open && (
        <m.div
          key="cancel-reason"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-reason-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          onClick={() => {
            if (!busy) onClose();
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
            {/* Header */}
            <div className="bg-rajlo-red px-5 py-5 text-white">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                  <Icon name="x" className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                    Cancel trip
                  </p>
                  <h2
                    id="cancel-reason-title"
                    className="text-xl font-extrabold leading-tight"
                  >
                    Why are you cancelling?
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/90">
                {role === "rider"
                  ? "Pick a reason so the driver knows what happened."
                  : "Pick a reason so the rider + Rajlo ops know what happened."}
              </p>
            </div>

            {/* Reasons */}
            <div className="space-y-2 px-5 py-5">
              {presets.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setSelected(r);
                    setShowOther(false);
                  }}
                  disabled={busy}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors disabled:opacity-60 ${
                    selected === r && !showOther
                      ? "border-rajlo-red bg-primary-soft text-rajlo-red"
                      : "border-line bg-surface-soft hover:border-rajlo-red/40"
                  }`}
                >
                  <span>{r}</span>
                  {selected === r && !showOther && (
                    <Icon name="check-circle" className="h-4 w-4 text-rajlo-red" />
                  )}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setShowOther(true);
                }}
                disabled={busy}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors disabled:opacity-60 ${
                  showOther
                    ? "border-rajlo-red bg-primary-soft text-rajlo-red"
                    : "border-line bg-surface-soft hover:border-rajlo-red/40"
                }`}
              >
                <span>Other (describe)</span>
                {showOther && (
                  <Icon name="check-circle" className="h-4 w-4 text-rajlo-red" />
                )}
              </button>

              {showOther && (
                <textarea
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="Tell us what happened…"
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-rajlo-red"
                  autoFocus
                  maxLength={400}
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 border-t border-line bg-surface-soft px-5 py-4 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => onConfirm(finalReason)}
                disabled={!canSubmit}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Icon name="x" className="h-4 w-4" />
                )}
                {busy ? "Cancelling…" : "Cancel trip"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-full px-6 py-3 text-sm font-semibold text-muted hover:text-foreground sm:flex-none disabled:opacity-60"
              >
                Keep trip
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
