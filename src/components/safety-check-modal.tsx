"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";

type ChatMessage = {
  id: string;
  authorRole: "rider" | "safety_officer" | "admin";
  authorName: string | null;
  body: string;
  isTip: boolean;
  createdAt: string;
};

/**
 * Safety check-in modal.
 *
 * Two trigger paths:
 *   1. Auto — driver hasn't moved for ~4 minutes during in_progress.
 *      The live-trip page's stop detector pops this with `auto=true`
 *      and a pre-created `safety_alerts` row of kind=unusual_stop.
 *   2. Manual — rider taps the "I need help" button at any time during
 *      the trip.
 *
 * Four actions:
 *   - "I'm fine" — resolves the alert (kind=unusual_stop) without
 *     paging ops. Logged for audit.
 *   - "Call police" — opens tel:119 (Jamaica Constabulary Force) AND
 *     escalates the alert to a real SOS so ops gets paged.
 *   - "Notify Rajlo safety team" — escalates to SOS only (no phone call).
 *   - "Call a trusted contact" — opens tel: to one of the rider's saved
 *     contacts. Doesn't escalate to ops.
 *
 * Escalation = POST another safety_alerts row with kind=sos so the SOS
 * endpoint's email + admin queue flow fires. We keep the original
 * unusual_stop alert open so ops sees both signals (the stop that
 * triggered the check + the rider's escalation).
 *
 * Auto-escalation timer: when triggered automatically, a 30-second
 * countdown runs. If the rider doesn't tap any action by 0, we silently
 * escalate to an ops-notified SOS — we'd rather wake ops for a false
 * positive than miss a genuine emergency.
 */

const AUTO_ESCALATE_AFTER_SEC = 30;

type TrustedContact = {
  id: string;
  name: string;
  phone: string;
  relationship: string;
};

export type SafetyCheckModalProps = {
  /** Set to false to dismiss. */
  open: boolean;
  /** The ride this safety check is attached to. */
  rideId: string;
  /** When the modal was auto-triggered (stop detector) we already have
   *  an alert row id from the initial POST. Used by "I'm fine" to mark
   *  resolved and by escalations as context. */
  alertId?: string | null;
  /** True when the modal was auto-triggered. Controls the 30-sec
   *  countdown + the "Are you OK?" framing. Manual opens skip the
   *  countdown and use a more general "Safety toolkit" framing. */
  auto: boolean;
  /** Which detector triggered this check. Drives the body copy:
   *   - `unusual_stop` → "The car hasn't moved in a few minutes."
   *   - `off_route`    → "Your driver may have gone off the planned route."
   *   - `manual`       → no body (rider opened the toolkit themselves). */
  kind?: "unusual_stop" | "off_route" | "manual";
  /** Rider's current GPS (best-effort) — included in any escalation
   *  so ops sees the latest position, not just the original stop. */
  currentPosition: { lat: number; lng: number } | null;
  /** Called when the rider dismisses (any path that closes the modal). */
  onClose: () => void;
};

export function SafetyCheckModal({
  open,
  rideId,
  alertId,
  auto,
  kind = "manual",
  currentPosition,
  onClose,
}: SafetyCheckModalProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_ESCALATE_AFTER_SEC);
  // Tracks which alert the rider is currently chatting on. Starts as
  // the unusual_stop alert (from props); flips to the escalated SOS
  // alert id if/when the rider escalates. We poll this alert's chat
  // thread so officers' messages show up inline.
  const [chatAlertId, setChatAlertId] = useState<string | null>(alertId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // Suppress the auto-escalation timer once the rider has taken ANY
  // action. We don't want to fire an unsolicited SOS at the moment
  // they've engaged.
  const escalationFiredRef = useRef(false);

  // Reset state when the modal opens fresh.
  useEffect(() => {
    if (open) {
      setBusy(null);
      setError(null);
      setDone(null);
      setContactsOpen(false);
      setSecondsLeft(AUTO_ESCALATE_AFTER_SEC);
      setChatAlertId(alertId ?? null);
      setMessages([]);
      setDraft("");
      escalationFiredRef.current = false;
    }
  }, [open, alertId]);

  // Poll chat thread every 4 seconds while the modal is open. As soon
  // as an officer sends a tip or message we surface it inline.
  useEffect(() => {
    if (!open || !chatAlertId) return;

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/rider/safety-alerts/${chatAlertId}/messages`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { messages: ChatMessage[] };
        if (!cancelled) setMessages(data.messages ?? []);
      } catch {
        // Silent — chat is best-effort during an incident.
      }
    };
    void load();
    const timer = setInterval(load, 4_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [open, chatAlertId]);

  const sendChat = async () => {
    if (!chatAlertId) return;
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch(
        `/api/rider/safety-alerts/${chatAlertId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { message: ChatMessage };
        setMessages((prev) => [...prev, data.message]);
        setDraft("");
      }
    } finally {
      setSending(false);
    }
  };

  // Latest-callback ref so the countdown effect can call `fireSos`
  // without depending on its identity. Re-deriving the closure each
  // render keeps `rideId` + `currentPosition` always current for the
  // auto-escalation path, but the effect itself only re-runs when
  // `open` / `auto` flip.
  //
  // Typed loosely with `unknown` because `fireSos` itself is declared
  // below this block — the assignment that points the ref at the real
  // function lives after `fireSos` exists.
  const fireSosRef = useRef<
    | ((opts: { reason: string; autoEscalated?: boolean; message?: string }) => Promise<boolean>)
    | null
  >(null);

  // Auto-escalation countdown (only for auto-triggered checks).
  useEffect(() => {
    if (!open || !auto) return;
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(tick);
          if (!escalationFiredRef.current) {
            escalationFiredRef.current = true;
            // Silent escalation — fire SOS so ops gets paged. We don't
            // close the modal; the rider may still tap "I'm fine".
            void fireSosRef.current?.({
              reason: "no_response_in_30s",
              autoEscalated: true,
            });
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [open, auto]);

  // Load contacts lazily — only when the rider taps "Contact someone".
  useEffect(() => {
    if (!contactsOpen) return;
    fetch("/api/rider/trusted-contacts")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setContacts(data.contacts ?? []))
      .catch(() => null);
  }, [contactsOpen]);

  const fireSos = async (opts: {
    reason: string;
    autoEscalated?: boolean;
    message?: string;
  }) => {
    try {
      const res = await fetch(`/api/rider/rides/${rideId}/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "sos",
          message:
            opts.message ??
            (opts.autoEscalated
              ? "Auto-escalated: rider didn't respond to unusual-stop check."
              : opts.reason),
          lat: currentPosition?.lat,
          lng: currentPosition?.lng,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Capture the new SOS alert id so the chat thread now points at
      // it — that's the alert an officer will be reading when the
      // rider escalates. The original unusual_stop alert may still
      // sit in the queue but officers triage the SOS first.
      const data = (await res.json().catch(() => null)) as
        | { alertId?: string }
        | null;
      if (data?.alertId) setChatAlertId(data.alertId);
      return true;
    } catch {
      return false;
    }
  };
  // Point the ref at the freshly-derived closure on every render so
  // the auto-escalation timer always reads the latest `rideId` /
  // `currentPosition` without re-running its effect.
  fireSosRef.current = fireSos;

  const resolveOriginalAlert = async (note: string) => {
    if (!alertId) return;
    await fetch(`/api/rider/safety-alerts/${alertId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "resolved",
        resolution_note: note,
      }),
    }).catch(() => null);
  };

  // ─── Actions ───

  const handleImFine = async () => {
    setBusy("im_fine");
    setError(null);
    // Cancel the pending auto-escalation.
    escalationFiredRef.current = true;
    await resolveOriginalAlert("Rider confirmed safe");
    setBusy(null);
    setDone("Confirmed — stay safe.");
    setTimeout(onClose, 800);
  };

  const handleCallPolice = async () => {
    setBusy("police");
    setError(null);
    escalationFiredRef.current = true;
    // Fire SOS first (so ops + record), then open tel:.
    const ok = await fireSos({
      reason: "Rider tapped Call Police",
      message: "Rider tapped Call Police from the in-trip safety modal.",
    });
    if (!ok) setError("Couldn't notify ops, but go ahead and dial.");
    setBusy(null);
    // Open the dialler — tel: links work on mobile + most desktops.
    window.location.href = "tel:119";
  };

  const handleNotifyOps = async () => {
    setBusy("ops");
    setError(null);
    escalationFiredRef.current = true;
    const ok = await fireSos({
      reason: "Rider tapped Notify Rajlo Safety",
    });
    setBusy(null);
    if (ok) {
      setDone("Rajlo safety team has been paged.");
      setTimeout(onClose, 1400);
    } else {
      setError("Couldn't reach the safety team. Try Call Police if urgent.");
    }
  };

  const handleCallContact = (phone: string) => {
    escalationFiredRef.current = true;
    window.location.href = `tel:${phone}`;
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-80 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-modal-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="bg-rajlo-red px-5 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Icon name="shield-alert" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                Safety check
              </p>
              <h2
                id="safety-modal-title"
                className="text-xl font-extrabold leading-tight"
              >
                {auto ? "Is everything OK?" : "Safety toolkit"}
              </h2>
            </div>
          </div>
          {auto && (
            <p className="mt-3 text-sm leading-relaxed text-white/90">
              {kind === "off_route"
                ? "Your driver appears to have left the planned route. "
                : "The car hasn't moved in a few minutes. "}
              Tap an option below — if you don&apos;t respond, we&apos;ll
              notify Rajlo&apos;s safety team automatically{" "}
              <strong className="font-extrabold">in {secondsLeft}s</strong>.
            </p>
          )}
          {!auto && (
            <p className="mt-3 text-sm leading-relaxed text-white/90">
              Pick any action below. We&apos;re here.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3 px-5 py-5">
          {/* I'm fine */}
          {auto && (
            <button
              type="button"
              onClick={handleImFine}
              disabled={busy !== null}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3.5 text-left font-bold text-emerald-800 transition-all hover:border-emerald-400 hover:bg-emerald-100 disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-white">
                  <Icon name="check-circle" className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-base">I&apos;m fine</span>
                  <span className="block text-xs font-medium text-emerald-700">
                    Stop the timer · stay on this trip
                  </span>
                </span>
              </span>
              {busy === "im_fine" && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              )}
            </button>
          )}

          {/* Call police */}
          <button
            type="button"
            onClick={handleCallPolice}
            disabled={busy !== null}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-rajlo-red px-4 py-3.5 text-left font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
                <Icon name="phone" className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-base">Call Police</span>
                <span className="block text-xs font-medium text-white/85">
                  Dials 119 · also pages Rajlo safety
                </span>
              </span>
            </span>
            {busy === "police" && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
          </button>

          {/* Notify Rajlo safety */}
          <button
            type="button"
            onClick={handleNotifyOps}
            disabled={busy !== null}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-rajlo-red bg-primary-soft px-4 py-3.5 text-left font-bold text-rajlo-red transition-all hover:bg-primary-soft/80 disabled:opacity-60"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-rajlo-red text-white">
                <Icon name="shield" className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-base">Notify Rajlo Safety</span>
                <span className="block text-xs font-medium text-rajlo-red/85">
                  Pages our safety team · they&apos;ll reach out
                </span>
              </span>
            </span>
            {busy === "ops" && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-rajlo-red border-t-transparent" />
            )}
          </button>

          {/* Call trusted contact — expandable */}
          <button
            type="button"
            onClick={() => setContactsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface-soft px-4 py-3.5 text-left font-bold text-foreground transition-all hover:border-rajlo-red/40 hover:bg-primary-soft/30"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-rajlo-black text-white">
                <Icon name="users" className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-base">Call a trusted contact</span>
                <span className="block text-xs font-medium text-muted">
                  Reach a saved person — no escalation
                </span>
              </span>
            </span>
            <Icon
              name={contactsOpen ? "chevron-up" : "chevron-down"}
              className="h-4 w-4 text-muted"
            />
          </button>

          {contactsOpen && (
            <div className="space-y-2 rounded-2xl border border-line bg-surface px-3 py-3">
              {contacts.length === 0 ? (
                <p className="text-center text-xs text-muted">
                  No saved contacts yet. Add some in{" "}
                  <Link
                    href="/rider/safety"
                    className="font-bold text-rajlo-red hover:underline"
                  >
                    Safety settings
                  </Link>
                  .
                </p>
              ) : (
                contacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCallContact(c.phone)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl bg-surface-soft px-3 py-2 text-left hover:bg-primary-soft/40"
                  >
                    <span>
                      <span className="block text-sm font-bold">{c.name}</span>
                      <span className="block text-[11px] text-muted">
                        {c.relationship} · {c.phone}
                      </span>
                    </span>
                    <Icon name="phone" className="h-4 w-4 text-rajlo-red" />
                  </button>
                ))
              )}
            </div>
          )}

          {/* Officer chat thread — shows whenever the alert has any
              messages, OR opens manually via the "Open chat" button so
              the rider can reach out before an officer pings them. */}
          {chatAlertId && (
            <SafetyChatPanel
              messages={messages}
              draft={draft}
              setDraft={setDraft}
              onSend={sendChat}
              sending={sending}
            />
          )}

          {error && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              {error}
            </p>
          )}
          {done && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              {done}
            </p>
          )}

          {/* Dismiss (manual mode only — auto mode forces an action) */}
          {!auto && (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl px-4 py-2 text-sm font-semibold text-muted hover:text-foreground"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline mini-chat with the Rajlo safety officer assigned to this
 * alert. Stays collapsed by default — the rider expands it to write a
 * message or to read tips the officer has sent. Officer messages
 * arriving via the 4-second poll auto-expand the panel so the rider
 * notices.
 */
function SafetyChatPanel({
  messages,
  draft,
  setDraft,
  onSend,
  sending,
}: {
  messages: ChatMessage[];
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  sending: boolean;
}) {
  const [userOpen, setUserOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Auto-open the panel once an officer message has landed — the rider
  // shouldn't have to tap to see a safety officer's reply. Once they've
  // manually toggled, their choice sticks. Derived from props instead
  // of setState-in-effect to satisfy React 19's purity rule.
  const hasOfficerMessage = messages.some((m) => m.authorRole !== "rider");
  const open = userOpen || hasOfficerMessage;
  const setOpen = (v: boolean) => setUserOpen(v);

  // Keep the scroll pinned to the latest message.
  const lastCountRef = useRef(messages.length);
  useEffect(() => {
    if (!open) return;
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, open]);

  const unreadOfficer = !open && hasOfficerMessage;

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-rajlo-red text-white">
            <Icon name="mail" className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-bold">
              Talk to Rajlo Safety
            </span>
            <span className="block text-[11px] text-muted">
              {messages.length === 0
                ? "Chat with an officer about this trip"
                : `${messages.length} message${messages.length === 1 ? "" : "s"} in this thread`}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {unreadOfficer && (
            <span className="rounded-full bg-rajlo-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              New
            </span>
          )}
          <Icon
            name={open ? "chevron-up" : "chevron-down"}
            className="h-4 w-4 text-muted"
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-line">
          <div
            ref={scrollerRef}
            className="max-h-56 space-y-2 overflow-y-auto px-3 py-3"
          >
            {messages.length === 0 ? (
              <p className="py-3 text-center text-[11px] text-muted">
                No messages yet. Write something below — an officer is
                monitoring this thread.
              </p>
            ) : (
              messages.map((m) => {
                const isRider = m.authorRole === "rider";
                return (
                  <div
                    key={m.id}
                    className={`flex ${isRider ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        isRider
                          ? "bg-rajlo-red text-white"
                          : m.isTip
                            ? "bg-amber-100 text-amber-900"
                            : "bg-surface-soft text-foreground"
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                        {isRider
                          ? "You"
                          : m.isTip
                            ? "Safety tip"
                            : "Rajlo Safety"}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap leading-snug">
                        {m.body}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <form
            className="flex items-end gap-2 border-t border-line bg-surface-soft px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message Rajlo Safety…"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-rajlo-red"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
            <button
              type="submit"
              disabled={sending || draft.trim().length === 0}
              className="rounded-full bg-rajlo-red px-3 py-2 text-xs font-bold text-white hover:bg-rajlo-red/90 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
