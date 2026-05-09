"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

/**
 * Safety toolkit — opened from the rider's live-trip page.
 *
 * Three tools:
 *   1. Call emergency services — `tel:` link to 119 (Jamaica police)
 *   2. SOS / flag — POST /api/rider/rides/[id]/sos  (alerts ops)
 *   3. Share live link — POST /api/rider/rides/[id]/share, then
 *      one-tap send to trusted contacts (WhatsApp / SMS) or anyone
 *      via the OS share sheet
 *
 * Renders as a centred dialog. The rider can close any time; SOS
 * specifically remains opt-in (we don't auto-fire so accidental taps
 * don't spam ops).
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
      <div className="relative w-full max-h-[92dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface shadow-2xl md:max-w-md md:rounded-3xl">
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
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-rajlo-red border-t-transparent" />
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
                  Generates a link your contacts can open and watch live —
                  no Rajlo account needed.
                </p>
              </div>
              <Icon
                name="arrow-right"
                className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-rajlo-red"
              />
            </button>
          ) : (
            <ShareLinkPanel
              shareUrl={shareUrl}
              onCopy={copyShare}
              copied={copied}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Share-link panel ─────────────── */

type Contact = {
  id: string;
  name: string;
  phone: string;
  relationship: string;
};

/**
 * Render once a trip share URL has been generated. Loads trusted
 * contacts and lets the rider one-tap send the link via WhatsApp or
 * SMS, or use the device's native share sheet ("Share to anywhere").
 */
function ShareLinkPanel({
  shareUrl,
  onCopy,
  copied,
}: {
  shareUrl: string;
  onCopy: () => void;
  copied: boolean;
}) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [hasNativeShare, setHasNativeShare] = useState(false);

  // Pre-baked share template the rider can preview + tweak before
  // sending. Contacts get this as the WhatsApp / SMS body, the
  // native-share `text` field also uses it.
  const template = `Track my Rajlo ride live: ${shareUrl}`;

  useEffect(() => {
    let cancelled = false;
    setHasNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
    (async () => {
      try {
        const res = await fetch("/api/rider/trusted-contacts");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { contacts: Contact[] };
        if (!cancelled) setContacts(json.contacts);
      } catch (e) {
        if (!cancelled)
          setContactsError(
            e instanceof Error ? e.message : "Couldn't load contacts.",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nativeShare = async () => {
    if (typeof navigator === "undefined" || !navigator.share) return;
    try {
      await navigator.share({
        title: "Track my Rajlo ride",
        text: template,
        url: shareUrl,
      });
    } catch {
      /* user cancelled the OS share sheet — silent. */
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-rajlo-red/30 bg-primary-soft/60 p-5">
      <div>
        <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
          Live trip share ready
        </p>
        <p className="mt-2 break-all rounded-xl bg-white px-3 py-2 font-mono text-xs text-foreground ring-1 ring-line">
          {shareUrl}
        </p>
      </div>

      {/* Send to trusted contacts */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Send to a trusted contact
          </p>
          {contacts !== null && (
            <span className="text-[11px] font-semibold text-muted">
              {contacts.length} saved
            </span>
          )}
        </div>

        {contactsError && (
          <p className="rounded-xl bg-white px-3 py-2 text-xs text-muted">
            {contactsError}
          </p>
        )}

        {contacts !== null && contacts.length === 0 && !contactsError && (
          <Link
            href="/rider/safety"
            className="group flex items-center gap-3 rounded-xl border border-dashed border-rajlo-red/40 bg-white px-4 py-3 transition-colors hover:border-rajlo-red hover:bg-primary-soft"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-rajlo-red">
              <Icon name="plus-circle" className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">No trusted contacts yet</p>
              <p className="text-[11px] text-muted">
                Add up to 5 in Safety settings for one-tap sharing.
              </p>
            </div>
            <Icon
              name="arrow-right"
              className="h-3.5 w-3.5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-rajlo-red"
            />
          </Link>
        )}

        {contacts && contacts.length > 0 && (
          <ul className="space-y-2">
            {contacts.map((c) => (
              <ContactRow key={c.id} contact={c} template={template} />
            ))}
          </ul>
        )}
      </div>

      {/* Other actions */}
      <div className="grid grid-cols-2 gap-2">
        {hasNativeShare && (
          <button
            type="button"
            onClick={nativeShare}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-rajlo-black px-4 py-2.5 text-xs font-bold text-white transition-all hover:-translate-y-0.5"
          >
            <Icon name="upload" className="h-3.5 w-3.5 rotate-180" />
            Share to anywhere
          </button>
        )}
        <button
          type="button"
          onClick={onCopy}
          className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-bold transition-all hover:-translate-y-0.5 ${
            hasNativeShare
              ? "border border-line bg-surface text-foreground"
              : "col-span-2 bg-rajlo-red text-white hover:bg-primary-hover"
          }`}
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
      </div>

      <p className="text-[11px] text-muted">
        The link stops working when your trip ends. WhatsApp + iMessage will
        unfurl it into a route preview when sent.
      </p>
    </div>
  );
}

/* ─────────── Contact row ─────────── */

function ContactRow({
  contact,
  template,
}: {
  contact: Contact;
  template: string;
}) {
  const initials = contact.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  // Phone normalisation for tel: / wa.me / sms: links — strip
  // everything that isn't a digit. Mainline JM numbers come in as
  // "+1 876 555 0143" or "876-555-0143", both of which collapse fine.
  const phoneDigits = contact.phone.replace(/\D/g, "");
  const encodedTemplate = encodeURIComponent(template);

  // wa.me opens the WhatsApp app (or web) with the message pre-filled
  // for the target contact. It's the cleanest deep-link to a known
  // number without needing the WhatsApp Business API.
  const whatsappHref = `https://wa.me/${phoneDigits}?text=${encodedTemplate}`;
  // sms: with a `body` param works on iOS + most Android. Some
  // clients drop `body` silently; the user can still type/paste.
  const smsHref = `sms:${phoneDigits}?body=${encodedTemplate}`;

  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rajlo-red text-xs font-extrabold text-white">
        {initials || "?"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{contact.name}</p>
        <p className="truncate text-[11px] text-muted">
          {contact.phone} · {contact.relationship}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Send link to ${contact.name} on WhatsApp`}
          className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-white transition-transform hover:-translate-y-0.5"
          title="Send on WhatsApp"
        >
          {/* WhatsApp icon — inlined to avoid taking a runtime
             dep on a brand icon set. Simple speech-bubble-with-call. */}
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="currentColor"
            aria-hidden
          >
            <path d="M19.05 4.93A10 10 0 0 0 4.45 17.86L3 22l4.27-1.4a10 10 0 0 0 11.78-15.67ZM12 19.5a7.49 7.49 0 0 1-3.83-1.05l-.27-.16-2.53.83.84-2.46-.18-.29A7.5 7.5 0 1 1 12 19.5Zm4.13-5.6c-.23-.11-1.34-.66-1.55-.74s-.36-.11-.51.12-.59.74-.72.89-.27.17-.5.06a6.13 6.13 0 0 1-1.81-1.12 6.85 6.85 0 0 1-1.26-1.57c-.13-.23 0-.36.1-.47s.23-.27.34-.4a1.6 1.6 0 0 0 .23-.39.42.42 0 0 0 0-.4c0-.11-.51-1.23-.7-1.69s-.37-.38-.51-.38h-.43a.83.83 0 0 0-.6.28 2.51 2.51 0 0 0-.79 1.87 4.36 4.36 0 0 0 .92 2.32 9.94 9.94 0 0 0 3.84 3.4 4.36 4.36 0 0 0 1.27.4 3 3 0 0 0 1.4-.06 2.27 2.27 0 0 0 1.5-1.06 1.84 1.84 0 0 0 .13-1.06c-.06-.1-.21-.16-.45-.27Z" />
          </svg>
        </a>
        <a
          href={smsHref}
          aria-label={`Send link to ${contact.name} via SMS`}
          className="grid h-9 w-9 place-items-center rounded-full bg-rajlo-red text-white transition-transform hover:-translate-y-0.5"
          title="Send via SMS"
        >
          <Icon name="mail" className="h-4 w-4" />
        </a>
      </div>
    </li>
  );
}
