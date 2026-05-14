"use client";

import { useState } from "react";
import { m } from "motion/react";
import { Icon } from "./icons";

/**
 * Reusable rating modal. Used by both rider history (rate the
 * driver) and driver history (rate the rider) when the user wants to
 * leave a star rating outside of the immediate post-trip flow.
 *
 * Caller hands us the endpoint URL and the title copy; we own the UI
 * and the POST. On success we fire `onSubmitted(stars)` so the parent
 * can update its row state without refetching.
 *
 * Why not reuse the rider's CompletionDialog? That one bundles the
 * "Trip total" hero + "Book another ride" CTA — which is right for
 * the moment a ride finishes but feels heavy for a "rate this past
 * trip" tap. RateDialog is the focused star-picker version.
 */
export function RateDialog({
  endpoint,
  title,
  subtitle,
  onClose,
  onSubmitted,
}: {
  endpoint: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmitted: (stars: number) => void;
}) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (n: number) => {
    if (submitting || submitted) return;
    setStars(n);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars: n }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        // 409 already-rated is a benign case — treat it as success
        // visually so the user isn't confused.
        if (res.status === 409) {
          setSubmitted(true);
          onSubmitted(n);
        } else {
          throw new Error(j.error ?? `Server returned ${res.status}`);
        }
      } else {
        setSubmitted(true);
        onSubmitted(n);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // Parent mounts this conditionally so an AnimatePresence wrapper
    // here can't replay exit on close — that would require lifting
    // open-state into every caller. Entry animation only is still a
    // clear "this just appeared" cue and matches what the other
    // popups now do on enter.
    <m.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-dialog-title"
      className="fixed inset-0 z-50 grid place-items-center bg-rajlo-black/60 px-4 py-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <m.div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-surface shadow-2xl"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-surface-soft text-muted transition-colors hover:bg-line hover:text-foreground"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>

        <div className="px-6 py-7 md:px-8">
          <h2
            id="rate-dialog-title"
            className="pr-10 text-xl font-extrabold tracking-tight"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          )}

          <p className="mt-5 text-center text-xs font-semibold uppercase tracking-wider text-muted">
            {submitted
              ? "Thanks for rating!"
              : submitting
                ? "Saving…"
                : "Tap a star"}
          </p>
          <div
            className="mt-2 flex items-center justify-center gap-2"
            onMouseLeave={() => setHover(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = n <= (hover || stars);
              const locked = submitting || submitted;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={locked}
                  onMouseEnter={() => !locked && setHover(n)}
                  onClick={() => submit(n)}
                  aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
                  className={`grid h-11 w-11 place-items-center rounded-full transition-all ${
                    filled
                      ? "bg-rajlo-red text-white shadow-md shadow-rajlo-red/30"
                      : "bg-surface-soft text-muted hover:bg-primary-soft hover:text-rajlo-red"
                  } ${locked ? "cursor-default" : "hover:-translate-y-0.5"}`}
                >
                  <Icon name="star" className="h-5 w-5" />
                </button>
              );
            })}
          </div>
          {error && (
            <p className="mt-3 text-center text-xs font-semibold text-rajlo-red">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-bold text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
          >
            {submitted ? "Done" : "Cancel"}
          </button>
        </div>
      </m.div>
    </m.div>
  );
}
