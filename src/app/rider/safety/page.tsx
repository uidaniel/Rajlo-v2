"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp } from "@/components/anim";
import { Skeleton, ToggleRowsSkeleton } from "@/components/skeleton";
import { useT } from "@/lib/i18n";

/**
 * Rider safety dashboard. Trusted contacts are persisted via
 * /api/rider/trusted-contacts (CRUD), and the auto-share defaults
 * sync via /api/rider/preferences with the same debounced auto-save
 * pattern as the settings page.
 */

type Contact = {
  id: string;
  name: string;
  phone: string;
  relationship: string;
};

type ServerPrefs = {
  auto_share_enabled: boolean;
  auto_share_notify_arrival: boolean;
  auto_share_notify_delay: boolean;
};

const RELATIONSHIPS = ["Family", "Partner", "Friend", "Roommate", "Other"];

const TOOLKIT_FEATURES: {
  icon: IconName;
  label: string;
  description: string;
  tone: "red" | "amber" | "emerald";
}[] = [
  {
    icon: "shield-alert",
    label: "SOS button",
    description:
      "Pings Rajlo's safety ops with your live location. We try to call you, then escalate to police.",
    tone: "red",
  },
  {
    icon: "users",
    label: "Share trip link",
    description:
      "Generate a public URL anyone can open to watch your trip live. Stops working when the trip ends.",
    tone: "emerald",
  },
  {
    icon: "phone",
    label: "Direct line to driver",
    description:
      "Call your driver without exposing your phone number. Numbers are masked both ways.",
    tone: "amber",
  },
  {
    icon: "flag",
    label: "Report a problem",
    description:
      "Flag a driver, trip, or safety concern. Goes directly to our trust & safety team.",
    tone: "red",
  },
];

export default function RiderSafetyPage() {
  const { t } = useT();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [autoShare, setAutoShare] = useState<{
    enabled: boolean;
    arrival: boolean;
    delay: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftRelationship, setDraftRelationship] = useState("Family");
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Native Contact Picker support — only available on Chrome / Edge
  // on Android. iOS Safari and desktop browsers don't ship this API,
  // so we feature-detect at mount and only show the button where it
  // actually works. iOS riders fall back to the manual form below.
  const [contactPickerSupported, setContactPickerSupported] = useState(false);
  const [pickingContact, setPickingContact] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setContactPickerSupported(hasContactPicker(navigator));
  }, []);

  const pickFromContacts = async () => {
    if (!hasContactPicker(navigator)) return;
    setPickingContact(true);
    setError(null);
    try {
      const results = await navigator.contacts!.select(["name", "tel"], {
        multiple: false,
      });
      if (results.length === 0) return; // user cancelled the picker
      const picked = results[0];
      // The API returns each property as a string[] — take the first
      // populated entry. Some contacts have multiple numbers; the
      // rider can edit the field after if they want a different one.
      const name = picked.name?.find((n) => n.trim()) ?? "";
      const tel = picked.tel?.find((t) => t.trim()) ?? "";
      if (name) setDraftName(name);
      if (tel) setDraftPhone(tel);
    } catch (err) {
      // Most likely "permission denied" — show a one-liner so the
      // rider knows why nothing happened, and they can fall back to
      // typing manually.
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't open contacts — type the name + number instead.",
      );
    } finally {
      setPickingContact(false);
    }
  };

  // Same debounced PATCH pattern as the settings page — toggles
  // optimistically update + queue a single API call.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePayload = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          fetch("/api/rider/trusted-contacts"),
          fetch("/api/rider/preferences"),
        ]);
        if (!cRes.ok || !pRes.ok) throw new Error("Couldn't load safety data.");
        const cJson = (await cRes.json()) as { contacts: Contact[] };
        const pJson = (await pRes.json()) as { preferences: ServerPrefs };
        if (cancelled) return;
        setContacts(cJson.contacts);
        setAutoShare({
          enabled: pJson.preferences.auto_share_enabled,
          arrival: pJson.preferences.auto_share_notify_arrival,
          delay: pJson.preferences.auto_share_notify_delay,
        });
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Couldn't load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const updateAutoShare = (
    patch: Partial<{ enabled: boolean; arrival: boolean; delay: boolean }>,
  ) => {
    setAutoShare((prev) => (prev ? { ...prev, ...patch } : prev));
    if (patch.enabled !== undefined)
      savePayload.current.autoShareEnabled = patch.enabled;
    if (patch.arrival !== undefined)
      savePayload.current.autoShareNotifyArrival = patch.arrival;
    if (patch.delay !== undefined)
      savePayload.current.autoShareNotifyDelay = patch.delay;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 500);
  };

  const flushSave = async () => {
    const body = savePayload.current;
    savePayload.current = {};
    if (Object.keys(body).length === 0) return;
    try {
      const res = await fetch("/api/rider/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedAt(Date.now());
      setError(null);
      setTimeout(() => setSavedAt(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    }
  };

  const addContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftName.trim() || !draftPhone.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rider/trusted-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draftName.trim(),
          phone: draftPhone.trim(),
          relationship: draftRelationship,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { contact: Contact };
      setContacts((prev) => [...prev, json.contact]);
      setDraftName("");
      setDraftPhone("");
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add contact.");
    } finally {
      setSubmitting(false);
    }
  };

  const removeContact = async (id: string) => {
    setRemovingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/rider/trusted-contacts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove contact.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-2 md:px-3 md:py-8">
      {/* Hero */}
      <FadeUp>
        <div className="relative overflow-hidden rounded-3xl bg-rajlo-red p-6 text-white shadow-xl shadow-rajlo-red/30 md:p-8">
          <ArcWatermark
            size={420}
            variant="white"
            className="absolute -right-24 -bottom-32 opacity-[0.10]"
          />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="font-secondary text-xs font-bold uppercase tracking-wider text-white/85">
                {t("safety.eyebrow", "Safety toolkit")}
              </p>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                {t("safety.title", "You're in control")}
              </h1>
              <p className="mt-2 max-w-lg text-sm text-white/85">
                {t(
                  "safety.subtitle",
                  "Trusted contacts, live trip sharing, SOS, and a direct line to Jamaica emergency services — every Rajlo trip ships with the full toolkit.",
                )}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white transition-opacity ${
                savedAt ? "opacity-100" : "opacity-0"
              }`}
            >
              Saved
            </span>
          </div>
        </div>
      </FadeUp>

      {error && (
        <div className="rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm font-semibold text-rajlo-red">
          {error}
        </div>
      )}

      {/* 119 Emergency ribbon */}
      <FadeUp delay={0.04}>
        <a
          href="tel:119"
          className="group flex items-center gap-4 rounded-2xl border-2 border-rajlo-red bg-rajlo-red p-5 text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-rajlo-red shadow-md">
            <Icon name="phone" className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/85">
              Jamaica emergency
            </p>
            <p className="text-2xl font-extrabold tracking-tight">
              Call Police · 119
            </p>
            <p className="mt-0.5 text-xs text-white/85">
              Tap to call directly. Use this immediately if you&apos;re in
              danger — Rajlo SOS will follow up.
            </p>
          </div>
          <Icon
            name="arrow-right"
            className="h-5 w-5 transition-transform group-hover:translate-x-1"
          />
        </a>
      </FadeUp>

      {/* Trusted contacts */}
      <FadeUp delay={0.08}>
        <Section title="Trusted contacts" icon="users">
          <p className="text-xs text-muted">
            Add up to 5 people who get an SMS with your live trip link when you
            tap &ldquo;Share trip&rdquo;.
          </p>

          {loading ? (
            // Contact-row-shaped skeleton: avatar + two text lines +
            // a remove button slot.
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-soft p-3">
              <Skeleton className="h-10 w-10" rounded="full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" rounded="md" />
                <Skeleton className="h-2.5 w-44" rounded="md" />
              </div>
              <Skeleton className="h-8 w-8" rounded="lg" />
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  removing={removingId === c.id}
                  onRemove={() => removeContact(c.id)}
                />
              ))}
              {contacts.length === 0 && (
                <p className="rounded-xl bg-surface-soft px-4 py-3 text-xs text-muted">
                  No trusted contacts yet — add at least one for one-tap
                  sharing.
                </p>
              )}
            </div>
          )}

          {!adding && contacts.length < 5 && !loading && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-line bg-surface-soft px-4 py-3 text-sm font-semibold text-muted transition-all hover:border-rajlo-red hover:bg-primary-soft/40 hover:text-rajlo-red"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-muted group-hover:bg-rajlo-red group-hover:text-white">
                <Icon name="plus-circle" className="h-4 w-4" />
              </span>
              Add a trusted contact
            </button>
          )}

          {adding && (
            <form
              onSubmit={addContact}
              className="space-y-3 rounded-xl border border-rajlo-red/30 bg-primary-soft/30 p-4"
            >
              {contactPickerSupported && (
                // One-tap import from the device's contact list. The
                // rider gets a native picker (no scrolling through a
                // list inside the app) and the form fields prefill
                // with their selection — they only have to tap the
                // relationship and Save. Falls through to the manual
                // form below for fine-tuning.
                <button
                  type="button"
                  onClick={pickFromContacts}
                  disabled={pickingContact || submitting}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-rajlo-red py-2.5 text-sm font-bold text-white shadow-md shadow-rajlo-red/20 transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                >
                  {pickingContact ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-[1.5px] border-white border-t-transparent" />
                  ) : (
                    <Icon name="user" className="h-4 w-4" />
                  )}
                  {pickingContact
                    ? "Opening contacts…"
                    : "Pick from my contacts"}
                </button>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  required
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Name"
                  className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15"
                />
                <input
                  required
                  type="tel"
                  value={draftPhone}
                  onChange={(e) => setDraftPhone(e.target.value)}
                  placeholder="Phone (+1 876…)"
                  className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15"
                />
              </div>
              <select
                value={draftRelationship}
                onChange={(e) => setDraftRelationship(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15"
              >
                {RELATIONSHIPS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setDraftName("");
                    setDraftPhone("");
                  }}
                  disabled={submitting}
                  className="flex-1 rounded-full border border-line bg-surface py-2 text-xs font-bold transition-colors hover:bg-surface-soft disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-full bg-rajlo-red py-2 text-xs font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save contact"}
                </button>
              </div>
            </form>
          )}
        </Section>
      </FadeUp>

      {/* Auto-share defaults */}
      <FadeUp delay={0.12}>
        <Section title="Auto-share defaults" icon="shield-check">
          <p className="text-xs text-muted">
            What happens automatically on every trip — change anytime mid-trip
            from the safety button.
          </p>
          {autoShare ? (
            <>
              <ToggleRow
                label="Share trip with contacts by default"
                description="Sends the live link the moment a driver accepts."
                value={autoShare.enabled}
                onChange={(v) => updateAutoShare({ enabled: v })}
              />
              <ToggleRow
                label="Notify on driver arrival"
                description="Push your contacts a 'Rider met driver' update."
                value={autoShare.arrival}
                disabled={!autoShare.enabled}
                onChange={(v) => updateAutoShare({ arrival: v })}
              />
              <ToggleRow
                label="Notify on unusual delay"
                description="If the trip is taking 2× the ETA, your contacts are alerted automatically."
                value={autoShare.delay}
                disabled={!autoShare.enabled}
                onChange={(v) => updateAutoShare({ delay: v })}
              />
            </>
          ) : (
            <ToggleRowsSkeleton rows={3} />
          )}
        </Section>
      </FadeUp>

      {/* Toolkit features */}
      <FadeUp delay={0.16}>
        <div>
          <div className="mb-3">
            <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
              In-trip toolkit
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">
              What you can do mid-trip
            </h2>
            <p className="mt-1 text-sm text-muted">
              Tap the shield button at the bottom of any active trip.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {TOOLKIT_FEATURES.map((f) => (
              <div
                key={f.label}
                className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-5"
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    f.tone === "red"
                      ? "bg-rajlo-red text-white"
                      : f.tone === "amber"
                        ? "bg-amber-500 text-white"
                        : "bg-emerald-500 text-white"
                  }`}
                >
                  <Icon name={f.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold tracking-tight">
                    {f.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </FadeUp>

      {/* Help link */}
      <FadeUp delay={0.24}>
        <Link
          href="/rider/support"
          className="group flex items-center justify-between rounded-2xl border border-dashed border-line bg-surface-soft px-5 py-4 transition-colors hover:border-rajlo-red hover:bg-primary-soft/40"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-rajlo-red shadow-sm">
              <Icon name="help-circle" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold">Have a safety concern?</p>
              <p className="mt-0.5 text-xs text-muted">
                Open the help centre or email us directly.
              </p>
            </div>
          </div>
          <Icon
            name="chevron-right"
            className="h-5 w-5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-rajlo-red"
          />
        </Link>
      </FadeUp>
    </div>
  );
}

/* ─────────── Helpers ─────────── */

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-soft text-rajlo-red">
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
        <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
          {title}
        </p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ContactRow({
  contact,
  removing,
  onRemove,
}: {
  contact: Contact;
  removing: boolean;
  onRemove: () => void;
}) {
  const initials = contact.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-line bg-surface-soft p-3 transition-opacity ${
        removing ? "opacity-50" : ""
      }`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rajlo-red text-sm font-extrabold text-white">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{contact.name}</p>
        <p className="truncate text-xs text-muted">
          {contact.phone} · {contact.relationship}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-primary-soft hover:text-rajlo-red disabled:opacity-50"
        aria-label={`Remove ${contact.name}`}
      >
        <Icon name="x" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
          value ? "bg-rajlo-red" : "bg-line"
        } ${disabled ? "cursor-not-allowed" : ""}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-all ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

/* ─────────────── Web Contact Picker API typing + detection ───────────────
 *
 * The Contact Picker API (https://w3c.github.io/contact-api/) ships
 * on Chrome / Edge on Android only — it's NOT in iOS Safari, NOT in
 * desktop browsers, and NOT in `lib.dom.d.ts` yet. We add minimal
 * type declarations here just for what we use, and feature-detect at
 * runtime so the "Pick from contacts" button only appears where the
 * API actually exists.
 */
type ContactInfo = {
  name?: string[];
  tel?: string[];
  email?: string[];
};

type ContactsManagerLike = {
  select(
    properties: Array<"name" | "tel" | "email" | "address" | "icon">,
    options?: { multiple?: boolean },
  ): Promise<ContactInfo[]>;
};

type NavigatorWithContacts = Navigator & {
  contacts?: ContactsManagerLike;
};

function hasContactPicker(nav: Navigator): nav is NavigatorWithContacts & {
  contacts: ContactsManagerLike;
} {
  // The spec requires both `navigator.contacts` AND a global
  // `ContactsManager` constructor. Checking both avoids false
  // positives on browsers that polyfill one without the other.
  return (
    "contacts" in nav &&
    typeof (nav as NavigatorWithContacts).contacts?.select === "function" &&
    typeof window !== "undefined" &&
    "ContactsManager" in window
  );
}
