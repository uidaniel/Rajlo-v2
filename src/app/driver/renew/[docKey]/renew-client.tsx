"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { ArcWatermark } from "@/components/arc-pattern";
import { Icon } from "@/components/icons";
import { FadeUp } from "@/components/anim";
import { FileUpload, type FileState } from "@/components/file-upload";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { uploadDriverDocument, removeDriverDocument } from "@/lib/storage";

export type CurrentDocState = {
  status: string;
  adminNote: string | null;
  expiresOn: string | null;
  fileName: string | null;
  previouslyApproved: boolean;
};

export function RenewClient({
  docKey,
  docLabel,
  docDescription,
  renewalPeriodDays,
  driverActive,
  current,
}: {
  docKey: string;
  docLabel: string;
  docDescription: string;
  renewalPeriodDays: number;
  driverActive: boolean;
  current: CurrentDocState;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileState>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Expiry date the driver reads off their physical document.
  // Initial value chain (best signal first):
  //   - the existing expiry on file (so a quick "I uploaded the
  //     wrong photo" doesn't lose the date the admin already
  //     verified)
  //   - today + renewal period (so a real renewal pre-fills a
  //     sensible default — driver only adjusts if the printed
  //     date differs)
  //   - empty string for permanent docs (selfie has period=0;
  //     the date input is hidden anyway)
  const requiresExpiry = renewalPeriodDays > 0;
  const [expiresOn, setExpiresOn] = useState<string>(() => {
    if (!requiresExpiry) return "";
    if (current.expiresOn) return current.expiresOn.slice(0, 10);
    const d = new Date(Date.now() + renewalPeriodDays * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  // Floor for the date picker so the OS-level date pickers (iOS,
  // Android) can't easily land on a past date.
  const minExpiryDate = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/driver/login");
        return;
      }
      setUserId(user.id);
    })();
  }, [router]);

  const handlePickFile = async (id: string, file: File) => {
    if (!userId) {
      setFiles((prev) => ({
        ...prev,
        [id]: { name: file.name, size: file.size, error: "Not signed in" },
      }));
      return;
    }

    const previousPath = files[id]?.path;
    setFiles((prev) => ({
      ...prev,
      [id]: { name: file.name, size: file.size, uploading: true },
    }));

    const result = await uploadDriverDocument({ userId, docKey: id, file });
    if ("error" in result) {
      setFiles((prev) => ({
        ...prev,
        [id]: { name: file.name, size: file.size, error: result.error },
      }));
      return;
    }
    setFiles((prev) => ({
      ...prev,
      [id]: { name: file.name, size: file.size, path: result.path },
    }));
    if (previousPath && previousPath !== result.path) {
      removeDriverDocument(previousPath).catch(() => {});
    }
  };

  const handleRemoveFile = async (id: string) => {
    const cur = files[id];
    if (cur?.path) removeDriverDocument(cur.path).catch(() => {});
    setFiles((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const uploaded = files[docKey];
  const fileReady = Boolean(uploaded?.path);
  const expiryReady = !requiresExpiry || Boolean(expiresOn);
  const ready = fileReady && expiryReady;
  const uploading = Boolean(uploaded?.uploading);

  const submit = async () => {
    if (!ready || !uploaded?.path) return;
    if (requiresExpiry && !expiresOn) {
      setSubmitError("Pick the expiry date printed on your document.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/driver/documents/${docKey}/replace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: uploaded.name,
          filePath: uploaded.path,
          // Send `null` for permanent docs so the server doesn't
          // hold onto a stale date from an earlier upload (rare,
          // but safer than omitting and letting it persist).
          expiresOn: requiresExpiry ? expiresOn : null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setDone(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ─────────── Success state ─────────── */
  if (done) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface-soft px-6 py-12 text-center">
        <ArcWatermark
          size={620}
          variant="red"
          className="absolute -right-32 -top-20 opacity-[0.05]"
        />
        <ArcWatermark
          size={520}
          variant="red"
          className="absolute -bottom-32 -left-20 opacity-[0.04]"
        />
        <FadeUp>
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-rajlo-red text-white shadow-2xl shadow-rajlo-red/30">
            <Icon name="check-circle" className="h-10 w-10" />
          </div>
        </FadeUp>
        <FadeUp delay={0.1}>
          <h1 className="mt-8 text-3xl font-extrabold tracking-tight md:text-4xl">
            {docLabel} submitted
          </h1>
        </FadeUp>
        <FadeUp delay={0.2}>
          <p className="mx-auto mt-4 max-w-md text-base text-muted">
            {driverActive
              ? "Your account stays active while operations re-reviews this document. We'll email you the moment it's approved."
              : "Operations will review your upload within 1–2 business days. You'll get an email the moment a decision is made."}
          </p>
        </FadeUp>
        <FadeUp delay={0.3}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => router.push("/driver/verification")}
              className="inline-flex items-center gap-2 rounded-full bg-rajlo-red px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
            >
              Back to TA verification
              <Icon name="arrow-right" className="h-4 w-4" />
            </button>
            <Link
              href="/driver"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-6 py-3 text-sm font-bold text-foreground hover:border-rajlo-red hover:text-rajlo-red"
            >
              Driver dashboard
            </Link>
          </div>
        </FadeUp>
      </div>
    );
  }

  /* ─────────── Upload state ─────────── */
  const statusBadge = currentStatusBadge(current);
  const renewalLabel = renewalPeriodLabel(renewalPeriodDays);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-surface-soft">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-2 py-3 md:px-3 md:py-4">
          <Logo size="sm" tagline />
          <Link
            href="/driver/verification"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-muted hover:bg-surface-soft hover:text-foreground"
          >
            <Icon name="chevron-left" className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-3xl flex-1 overflow-hidden px-2 py-8 md:px-3 md:py-12">
        <ArcWatermark
          size={520}
          variant="red"
          className="pointer-events-none absolute -right-32 -top-10 opacity-[0.04]"
        />

        {/* Hero */}
        <FadeUp>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-rajlo-red">
              <Icon name="shield-check" className="h-3 w-3" />
              TA renewal
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
            {docLabel}
          </h1>
          <p className="mt-2 text-sm text-muted md:text-base">
            {docDescription}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <Icon name="clock" className="h-3 w-3" />
              {renewalLabel}
            </span>
            {current.expiresOn && (
              <span className="flex items-center gap-1.5">
                <Icon name="check-circle" className="h-3 w-3" />
                Currently expires{" "}
                {new Date(current.expiresOn).toLocaleDateString("en-JM", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            {current.fileName && (
              <span className="flex items-center gap-1.5 truncate">
                <Icon name="upload" className="h-3 w-3" />
                Existing file: {current.fileName}
              </span>
            )}
          </div>
        </FadeUp>

        {/* Active driver reassurance banner */}
        {driverActive && current.previouslyApproved && (
          <FadeUp delay={0.04}>
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white">
                <Icon name="check-circle" className="h-4 w-4" />
              </span>
              <div className="text-xs leading-relaxed">
                <p className="font-extrabold">You stay active during re-review</p>
                <p className="mt-0.5">
                  Keep accepting rides while operations checks your renewed
                  document. You&apos;ll only be paused if the new file is rejected.
                </p>
              </div>
            </div>
          </FadeUp>
        )}

        {/* Admin note */}
        {current.adminNote && current.status === "rejected" && (
          <FadeUp delay={0.05}>
            <div className="mt-6 overflow-hidden rounded-2xl border border-rajlo-red/30 bg-primary-soft p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rajlo-red text-white">
                  <Icon name="alert-triangle" className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-secondary text-[11px] font-bold uppercase tracking-wider text-rajlo-red">
                    Why it was rejected
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">
                    {current.adminNote}
                  </p>
                </div>
              </div>
            </div>
          </FadeUp>
        )}

        {/* Upload card */}
        <FadeUp delay={0.08}>
          <div className="mt-6 rounded-3xl border border-line bg-surface p-6 shadow-sm shadow-rajlo-red/[0.03] md:p-7">
            <FileUpload
              field={{ id: docKey, label: "New document file", required: true }}
              files={files}
              onPick={handlePickFile}
              onRemove={handleRemoveFile}
            />

            {/* Expiry date — required for any doc with a renewal
               period. Hidden for permanent docs (the selfie). The
               value pre-fills to today + the standard renewal period
               so the driver can usually just confirm the default
               instead of typing it from scratch. */}
            {requiresExpiry && (
              <label className="mt-5 block">
                <p className="text-sm font-semibold">
                  Expiry date on this document
                  <span className="ml-1 text-rajlo-red">*</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Read the date directly from the document. We use it to
                  remind you before it expires.
                </p>
                <input
                  type="date"
                  value={expiresOn}
                  min={minExpiryDate}
                  onChange={(e) => setExpiresOn(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-surface-soft px-3 py-2.5 text-sm font-bold focus:border-rajlo-red focus:outline-none"
                />
              </label>
            )}

            <ul className="mt-5 space-y-2 text-xs text-muted">
              <Tip>Use a clear, in-focus photo or scan — no glare or cropping.</Tip>
              <Tip>PDF, JPG or PNG, up to 10MB.</Tip>
              <Tip>
                Make sure your full name is clearly visible alongside the
                expiry date.
              </Tip>
            </ul>
          </div>
        </FadeUp>

        {submitError && (
          <div className="mt-5 rounded-xl border border-rajlo-red/20 bg-primary-soft px-4 py-3 text-sm text-rajlo-red">
            {submitError}
          </div>
        )}
      </div>

      {/* Sticky action bar */}
      <footer className="sticky bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-2 py-3 md:px-3 md:py-4">
          <p className="text-xs font-semibold text-muted">
            {ready
              ? "Ready to submit for review"
              : uploading
                ? "Uploading…"
                : !fileReady
                  ? "Pick a file to continue"
                  : "Add the expiry date to continue"}
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !ready || uploading}
            className="inline-flex items-center gap-1.5 rounded-full bg-rajlo-red px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-rajlo-red/20 transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:-translate-y-0"
          >
            {submitting ? "Submitting…" : "Submit for review"}
            {!submitting && <Icon name="check-circle" className="h-4 w-4" />}
          </button>
        </div>
      </footer>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 grid h-1.5 w-1.5 shrink-0 place-items-center rounded-full bg-rajlo-red" />
      <span>{children}</span>
    </li>
  );
}

function currentStatusBadge(current: CurrentDocState): {
  label: string;
  className: string;
} {
  const days = current.expiresOn
    ? Math.ceil(
        (new Date(current.expiresOn).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  if (current.status === "rejected")
    return {
      label: "Rejected",
      className: "border-rajlo-red/30 bg-primary-soft text-rajlo-red",
    };
  if (current.status === "missing" || current.status === "expired")
    return {
      label: current.status === "expired" ? "Expired" : "Not uploaded",
      className: "border-rajlo-red/30 bg-primary-soft text-rajlo-red",
    };
  if (current.status === "pending")
    return {
      label: "Pending review",
      className: "border-emerald-300 bg-emerald-50 text-emerald-800",
    };
  if (days !== null && days < 0)
    return {
      label: "Expired",
      className: "border-rajlo-red/30 bg-primary-soft text-rajlo-red",
    };
  if (days !== null && days <= 30)
    return {
      label: `Renew · ${days}d left`,
      className: "border-amber-300 bg-amber-50 text-amber-800",
    };
  if (days !== null && days <= 60)
    return {
      label: `Renew · ${days}d left`,
      className: "border-emerald-300 bg-emerald-50 text-emerald-800",
    };
  return {
    label: "Approved",
    className: "border-emerald-300 bg-emerald-50 text-emerald-800",
  };
}

function renewalPeriodLabel(periodDays: number): string {
  if (periodDays === 0) return "Permanent";
  if (periodDays <= 365) return "Renew yearly";
  if (periodDays <= 730) return "Renew every 2 years";
  if (periodDays <= 1825) return "Renew every 5 years";
  return `Renew every ${Math.round(periodDays / 365)} years`;
}
