"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

/**
 * Safety toolkit — opened from the rider's live-trip page.
 *
 * Three tools:
 *   1. Call emergency services — `tel:` link to 119 (Jamaica police)
 *   2. SOS / flag — POST /api/rider/rides/[id]/sos  (alerts ops)
 *   3. Share live link — POST /api/rider/rides/[id]/share (one-off public URL)
 *
 * Renders as a centred dialog. The rider can close any time; SOS
 * specifically remains opt-in (we don't auto-fire so accidental taps don't
 * spam ops).
 */
export function SafetySheet({
  rideId,
  livePosition,
  onClose,
}: {
  rideId: string;
  livePosition: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedKind, setSubmittedKind] = useState<"sos" | "flag" | null>(
    null,
  );
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submitSafety = async (kind: "sos" | "flag", message?: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rider/rides/${rideId}/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message,
          lat: livePosition?.lat ?? null,
          lng: livePosition?.lng ?? null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Server returned ${res.status}`);
      }
      setSubmittedKind(kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send alert.");
    } finally {
      setSubmitting(false);
    }
  };

  const generateShare = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rider/rides/${rideId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Server returned ${res.status}`);
      }
      const json = (await res.json()) as { url: string };
      setShareUrl(json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate link.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard might be blocked; user can long-press to copy manually */
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-title"
      className="fixed inset-0 z-50 grid place-items-end bg-black/50 backdrop-blur-sm md:place-items-center md:px-4"
    >
      <div className="relative w-full overflow-hidden rounded-t-3xl border-t border-line bg-surface shadow-2xl md:max-w-md md:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-line bg-rajlo-red/95 px-6 py-5 text-white">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-rajlo-red shadow-md">
              <Icon name="shield" className="h-5 w-5" />
            </span>
            <div>
              <p
                id="safety-title"
                className="text-lg font-extrabold tracking-tight"
              >
                Safety toolkit
              </p>
              <p className="mt-0.5 text-xs text-white/85">
                Tap the option that fits — we&apos;ll handle the rest.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-md text-white/80 hover:bg-white/15 hover:text-white"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-5">
          {/* Confirmation flash */}
          {submittedKind && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm">
              <p className="font-bold text-emerald-700">
                {submittedKind === "sos" ? "SOS sent" : "Flag raised"}
              </p>
              <p className="mt-0.5 text-xs text-emerald-700/85">
                {submittedKind === "sos"
                  ? "Rajlo operations has been paged. They'll call you shortly. If you're in immediate danger, call 119 now."
                  : "Operations will follow up after the trip."}
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm font-semibold text-rajlo-red">
              {error}
            </div>
          )}

          {/* Call 119 — simplest, fastest path. */}
          <a
            href="tel:119"
            className="group flex items-center gap-4 rounded-2xl border-2 border-rajlo-red bg-rajlo-red p-5 text-left text-white shadow-md transition-all hover:-translate-y-0.5"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-rajlo-red">
              <Icon name="phone" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold tracking-tight">
                Call 119 — Police
              </p>
              <p className="text-xs text-white/85">
                Direct line to Jamaica Constabulary. Use for immediate danger.
              </p>
            </div>
            <Icon name="arrow-right" className="h-4 w-4 text-white/85" />
          </a>

          {/* SOS — alerts Rajlo ops. */}
          <button
            type="button"
            disabled={submitting || submittedKind === "sos"}
            onClick={() => submitSafety("sos")}
            className="group flex w-full items-center gap-4 rounded-2xl border border-rajlo-red/30 bg-primary-soft p-5 text-left transition-all hover:-translate-y-0.5 hover:border-rajlo-red disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rajlo-red text-white">
              <Icon name="alert-triangle" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold tracking-tight">
                Alert Rajlo support (SOS)
              </p>
              <p className="text-xs text-muted">
                Pages our 24/7 operations team with your live location. We
                call you back within minutes.
              </p>
            </div>
            {submitting && submittedKind !== "sos" ? (
              <span className="h-4 w-4 animate-spin rounded-full border-[2px] border-rajlo-red border-t-transparent" />
            ) : (
              <Icon
                name="arrow-right"
                className="h-4 w-4 text-rajlo-red transition-transform group-hover:translate-x-0.5"
              />
            )}
          </button>

          {/* Share live trip link — friend can watch in real time. */}
          {!shareUrl ? (
            <button
              type="button"
              disabled={submitting}
              onClick={generateShare}
              className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-5 text-left transition-all hover:-translate-y-0.5 hover:border-rajlo-red/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rajlo-black text-white">
                <Icon name="users" className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-extrabold tracking-tight">
                  Share live trip with a friend
                </p>
                <p className="text-xs text-muted">
                  Generates a one-tap link. They open it and watch your trip
                  live — no Rajlo account needed.
                </p>
              </div>
              <Icon
                name="arrow-right"
                className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-rajlo-red"
              />
            </button>
          ) : (
            <div className="rounded-2xl border border-rajlo-red/30 bg-primary-soft/60 p-5">
              <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                Share this link
              </p>
              <p className="mt-2 break-all rounded-xl bg-white px-3 py-2 text-xs font-mono text-rajlo-black ring-1 ring-line">
                {shareUrl}
              </p>
              <button
                type="button"
                onClick={copyShare}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-rajlo-red px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover"
              >
                {copied ? (
                  <>
                    <Icon name="check-circle" className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Icon name="file-text" className="h-3.5 w-3.5" />
                    Copy link
                  </>
                )}
              </button>
              <p className="mt-3 text-[11px] text-muted">
                The link stops working when your trip ends.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
