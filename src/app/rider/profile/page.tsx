"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp } from "@/components/anim";
import { AvatarUploader } from "@/components/avatar-uploader";
import { Skeleton } from "@/components/skeleton";

/**
 * Rider profile editor. Self-edit for the cross-role bits:
 *   - Full name (display name shown to drivers)
 *   - Profile picture (uploaded to the public avatars bucket)
 *
 * Email is read-only here — changing it requires re-verification, a
 * separate auth flow we'll wire up later. For now the field is shown
 * for context with a small note.
 *
 * Driver-specific fields (vehicle, plate, compliance) live on
 * /driver/profile. This page is rider-focused; the same
 * AvatarUploader component is reused on the driver side.
 */

type ProfileResponse = {
  profile: {
    id: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    role: string | null;
  };
};

export default function RiderProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Snapshot of the loaded values so we can detect dirty state and
  // disable the save button when nothing has actually changed.
  const [loadedName, setLoadedName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/profile");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ProfileResponse;
        if (cancelled) return;
        setEmail(json.profile.email);
        setFullName(json.profile.fullName ?? "");
        setLoadedName(json.profile.fullName ?? "");
        setAvatarUrl(json.profile.avatarUrl);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Couldn't load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = fullName.trim() !== loadedName.trim();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Server returned ${res.status}`);
      }
      setLoadedName(fullName);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const initials =
    (fullName || email || "R")
      .split(/[\s@]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "R";

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5  py-2 md:px-3 md:py-8">
        <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-6 md:p-8">
          <Skeleton variant="dark" className="h-3 w-24" rounded="full" />
          <Skeleton
            variant="dark"
            className="mt-3 h-9 w-1/2 max-w-64"
            rounded="lg"
          />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <Skeleton className="h-7 w-7" rounded="lg" />
            <Skeleton className="h-2.5 w-20" rounded="md" />
          </div>
          <Skeleton className="h-24 w-24" rounded="full" />
          <div className="mt-6 space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-16" rounded="md" />
                <Skeleton className="h-12 w-full" rounded="xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !email) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft">
          <span aria-hidden className="text-3xl leading-none">😢</span>
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
          Profile unavailable
        </h1>
        <p className="mt-2 text-sm text-muted">{error}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="mx-auto max-w-3xl space-y-5 px-2 py-6 md:px-3 md:py-8"
    >
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
                Profile
              </p>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                {fullName || "Your profile"}
              </h1>
              <p className="mt-1 text-sm text-white/75">
                Edit your name and profile picture. These show on every trip —
                drivers see them when they accept your ride.
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

      {/* Photo */}
      <FadeUp delay={0.05}>
        <Section title="Profile picture" icon="user">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <AvatarUploader
              currentUrl={avatarUrl}
              fallbackInitials={initials}
              size="lg"
              onUploaded={(url) => setAvatarUrl(url)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Pick something recognisable</p>
              <p className="mt-0.5 text-xs text-muted">
                Drivers spot you faster at pickup if your photo looks like you.
                Square images crop best.
              </p>
            </div>
          </div>
        </Section>
      </FadeUp>

      {/* Name + email */}
      <FadeUp delay={0.1}>
        <Section title="Personal info" icon="user">
          <label className="block">
            <span className="text-xs font-semibold text-muted">
              Full name <span className="ml-0.5 text-rajlo-red">*</span>
            </span>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={80}
              placeholder="Marlon Brown"
              className="mt-1 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none transition-all placeholder:text-muted/70 focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15"
            />
            <p className="mt-1 text-[11px] text-muted">
              How drivers see you on a trip request.
            </p>
          </label>

          <div>
            <p className="text-xs font-semibold text-muted">Email</p>
            <p className="mt-1 rounded-xl border border-dashed border-line bg-surface-soft px-4 py-3 text-sm font-bold">
              {email ?? "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Email changes need re-verification — contact support.
            </p>
          </div>
        </Section>
      </FadeUp>

      {/* Quick links */}
      <FadeUp delay={0.15}>
        <Section title="Other settings" icon="grid">
          <LinkRow
            label="Notifications & app preferences"
            description="Push, language, theme."
            href="/rider/settings"
            icon="settings"
          />
          <LinkRow
            label="Safety toolkit"
            description="Trusted contacts + auto-share defaults."
            href="/rider/safety"
            icon="shield"
          />
          <LinkRow
            label="Help & support"
            description="FAQs and contact us."
            href="/rider/support"
            icon="help-circle"
          />
        </Section>
      </FadeUp>

      {/* Save bar — sticky on mobile so it's always reachable. */}
      <FadeUp delay={0.2}>
        <div className="sticky bottom-0 z-10 -mx-2 flex flex-col gap-2 border-t border-line bg-surface/95 px-2 py-3 backdrop-blur md:relative md:mx-0 md:rounded-2xl md:border md:px-5 md:py-4">
          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={!dirty || saving}
              className="inline-flex items-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:-translate-y-0"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving…
                </>
              ) : (
                <>
                  Save changes
                  <Icon name="check-circle" className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </FadeUp>
    </form>
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
