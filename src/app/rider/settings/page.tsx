"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp } from "@/components/anim";
import { ToggleRowsSkeleton } from "@/components/skeleton";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Rider settings — account profile + push preferences + app
 * preferences + account actions.
 *
 * All toggles + segmented controls auto-save with a 500ms debounce
 * via /api/rider/preferences (PATCH). No manual save button — the
 * UI just shows a "Saved" badge briefly when a write commits.
 *
 * Profile section reads name + email + avatar from Supabase auth
 * (Google OAuth metadata mostly). Editing those needs auth-side
 * flows (re-verification for email, magic link, etc.) which is a
 * follow-up — the "Edit" button currently just routes to support.
 */

type ProfileInfo = {
  fullName: string;
  email: string;
  avatarUrl: string | null;
};

/** Server-shape of the preferences row (snake_case to match DB columns). */
type ServerPrefs = {
  push_enabled: boolean;
  push_trip_updates: boolean;
  push_driver_arrival: boolean;
  push_promos: boolean;
  push_safety_tips: boolean;
  language: "en" | "patois";
  theme: "system" | "light" | "dark";
  auto_share_enabled: boolean;
  auto_share_notify_arrival: boolean;
  auto_share_notify_delay: boolean;
};

/** Wire format for PATCH (camelCase). Mirror of what the API
 *  accepts, kept in one place so all the toggle handlers stay tidy. */
type WirePrefs = {
  pushEnabled: boolean;
  pushTripUpdates: boolean;
  pushDriverArrival: boolean;
  pushPromos: boolean;
  pushSafetyTips: boolean;
  language: "en" | "patois";
  theme: "system" | "light" | "dark";
  autoShareEnabled: boolean;
  autoShareNotifyArrival: boolean;
  autoShareNotifyDelay: boolean;
};

const fromServer = (p: ServerPrefs): WirePrefs => ({
  pushEnabled: p.push_enabled,
  pushTripUpdates: p.push_trip_updates,
  pushDriverArrival: p.push_driver_arrival,
  pushPromos: p.push_promos,
  pushSafetyTips: p.push_safety_tips,
  language: p.language,
  theme: p.theme,
  autoShareEnabled: p.auto_share_enabled,
  autoShareNotifyArrival: p.auto_share_notify_arrival,
  autoShareNotifyDelay: p.auto_share_notify_delay,
});

export default function RiderSettingsPage() {
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [prefs, setPrefs] = useState<WirePrefs | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Debounced PATCH — coalesces rapid-fire toggle taps into a single
  // request. Held in a ref so changing prefs doesn't reset the timer.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePayload = useRef<Partial<WirePrefs>>({});

  // Initial load — auth user + preferences. We do them in parallel
  // so the page renders fast.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const [
        {
          data: { user },
        },
        prefsRes,
      ] = await Promise.all([
        supabase.auth.getUser(),
        fetch("/api/rider/preferences").then((r) =>
          r.ok ? (r.json() as Promise<{ preferences: ServerPrefs }>) : null,
        ),
      ]);
      if (cancelled) return;
      setProfile({
        fullName:
          (user?.user_metadata?.full_name as string | undefined) ??
          user?.email ??
          "Rider",
        email: user?.email ?? "",
        avatarUrl:
          (user?.user_metadata?.avatar_url as string | undefined) ?? null,
      });
      if (prefsRes) setPrefs(fromServer(prefsRes.preferences));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup the debounce timer on unmount so a still-pending save
  // doesn't fire after navigation.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Helper: update a field locally + queue the same field for the
  // next debounced write. Optimistic — the UI never waits on the
  // network.
  const update = <K extends keyof WirePrefs>(key: K, value: WirePrefs[K]) => {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
    savePayload.current = { ...savePayload.current, [key]: value };
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
      setError(e instanceof Error ? e.message : "Couldn't save preferences.");
    }
  };

  const initials = profile?.fullName
    ? profile.fullName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join("")
    : "R";

  const handleSignOut = async () => {
    if (!confirm("Sign out of Rajlo?")) return;
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.href = "/";
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-2 md:px-3 md:py-8">
      {/* Hero */}
      <FadeUp>
        <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-6 text-white shadow-xl shadow-rajlo-black/30 md:p-8">
          <ArcWatermark
            size={360}
            variant="red"
            className="absolute -right-20 -bottom-24 opacity-[0.18]"
          />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                Account
              </p>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                Settings
              </h1>
              <p className="mt-1 text-sm text-white/75">
                Profile, notifications, app preferences, and account safety.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200 transition-opacity ${
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

      {/* Profile card */}
      <FadeUp delay={0.05}>
        <Section title="Profile" icon="user">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft text-lg font-extrabold text-rajlo-red ring-1 ring-rajlo-red/20">
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-extrabold tracking-tight">
                {profile?.fullName ?? "Loading…"}
              </p>
              <p className="truncate text-xs text-muted">
                {profile?.email ?? ""}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                <Icon name="shield-check" className="h-3 w-3" />
                Verified email
              </p>
            </div>
            <Link
              href="/rider/profile"
              className="shrink-0 rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold transition-colors hover:bg-surface-soft"
            >
              Edit
            </Link>
          </div>
        </Section>
      </FadeUp>

      {/* Push notifications */}
      <FadeUp delay={0.1}>
        <Section title="Push notifications" icon="bell">
          {prefs ? (
            <>
              <ToggleRow
                label="Allow push notifications"
                description="Master switch — turn off to mute everything below."
                value={prefs.pushEnabled}
                onChange={(v) => update("pushEnabled", v)}
              />
              <Divider />
              <ToggleRow
                label="Trip updates"
                description="Driver accepted, arrived, started, completed."
                value={prefs.pushTripUpdates}
                disabled={!prefs.pushEnabled}
                onChange={(v) => update("pushTripUpdates", v)}
              />
              <ToggleRow
                label="Driver arrival"
                description="Loud ping when your driver pulls up."
                value={prefs.pushDriverArrival}
                disabled={!prefs.pushEnabled}
                onChange={(v) => update("pushDriverArrival", v)}
              />
              <ToggleRow
                label="Promotions & discounts"
                description="Carpool deals, free-trip rewards, and seasonal promos."
                value={prefs.pushPromos}
                disabled={!prefs.pushEnabled}
                onChange={(v) => update("pushPromos", v)}
              />
              <ToggleRow
                label="Safety tips"
                description="Periodic reminders about safety toolkit features."
                value={prefs.pushSafetyTips}
                disabled={!prefs.pushEnabled}
                onChange={(v) => update("pushSafetyTips", v)}
              />
            </>
          ) : (
            <ToggleRowsSkeleton rows={5} />
          )}
        </Section>
      </FadeUp>

      {/* Preferences */}
      <FadeUp delay={0.15}>
        <Section title="App preferences" icon="settings">
          {prefs ? (
            <>
              <SegmentedRow
                label="Language"
                description="Used across the app + email receipts."
                value={prefs.language}
                onChange={(v) => update("language", v as "en" | "patois")}
                options={[
                  { value: "en", label: "English" },
                  { value: "patois", label: "Patois" },
                ]}
              />
              <Divider />
              <SegmentedRow
                label="Theme"
                description="Match your device or pin to one mode."
                value={prefs.theme}
                onChange={(v) =>
                  update("theme", v as "system" | "light" | "dark")
                }
                options={[
                  { value: "system", label: "System" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </>
          ) : (
            <ToggleRowsSkeleton rows={2} />
          )}
        </Section>
      </FadeUp>

      {/* Quick links */}
      <FadeUp delay={0.2}>
        <Section title="Connected" icon="grid">
          <LinkRow
            label="Payment methods"
            description="Cards, mobile money, and cash settings."
            href="/rider/payments"
            icon="credit-card"
          />
          <LinkRow
            label="Safety toolkit"
            description="Trusted contacts, SOS, share-trip defaults."
            href="/rider/safety"
            icon="shield"
          />
          <LinkRow
            label="Help & support"
            description="FAQs, contact us, and report a problem."
            href="/rider/support"
            icon="help-circle"
          />
        </Section>
      </FadeUp>

      {/* Danger zone */}
      <FadeUp delay={0.25}>
        <div className="rounded-2xl border border-rajlo-red/20 bg-primary-soft/40 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rajlo-red text-white">
              <Icon name="log-out" className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold tracking-tight">Sign out</p>
              <p className="mt-0.5 text-xs text-muted">
                You&apos;ll need to sign in again on this device.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-full bg-rajlo-red px-5 py-2 text-xs font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={0.3}>
        <p className="text-center text-[11px] text-muted">
          Rajlo · Jamaica&apos;s red-plate ride network
        </p>
      </FadeUp>
    </div>
  );
}

/* ─────────── Reusable section primitives ─────────── */

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

function Divider() {
  return <div className="my-1 h-px bg-line" />;
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

function SegmentedRow({
  label,
  description,
  value,
  onChange,
  options,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <div className="mb-3">
        <p className="text-sm font-bold">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <div className="inline-flex rounded-full border border-line bg-surface-soft p-1">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                active
                  ? "bg-rajlo-red text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LinkRow({
  label,
  description,
  href,
  icon,
}: {
  label: string;
  description: string;
  href: string;
  icon: IconName;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-line bg-surface-soft px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-rajlo-red hover:bg-primary-soft/40"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-rajlo-red shadow-sm">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <Icon
        name="chevron-right"
        className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-rajlo-red"
      />
    </Link>
  );
}
