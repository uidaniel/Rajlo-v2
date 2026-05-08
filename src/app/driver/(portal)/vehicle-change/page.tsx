"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp } from "@/components/anim";
import {
  EMPTY_VEHICLE_SPEC,
  VehiclePicker,
  type VehicleSpec,
} from "@/components/vehicle-picker";
import {
  FileUpload,
  type FileState,
} from "@/components/file-upload";
import { Skeleton } from "@/components/skeleton";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  uploadDriverDocument,
  removeDriverDocument,
} from "@/lib/storage";

/**
 * Driver vehicle-change request flow. Verified drivers can't
 * silently swap vehicles — they need to:
 *   1. Pick the new vehicle from the catalog
 *   2. Upload three new compliance docs (registration, COF, insurance)
 *   3. Optionally explain why
 *   4. Wait for admin review (1–2 business days, usually faster)
 *
 * If a request is already pending, this page renders a status card
 * with a "Cancel request" option instead of the form.
 */

type ChangeRequest = {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requested_type: string;
  requested_brand: string;
  requested_model: string;
  requested_year: number;
  requested_color: string;
  requested_plate: string | null;
  note: string | null;
  admin_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

const REQUIRED_DOCS = [
  {
    id: "vehicle_change_registration",
    label: "New vehicle registration (PPV red plate)",
    hint: "Updated registration showing the new vehicle and PPV red-plate status.",
    required: true,
  },
  {
    id: "vehicle_change_cof",
    label: "Certificate of Fitness (COF) for new vehicle",
    hint: "Annual fitness inspection issued for this specific vehicle.",
    required: true,
  },
  {
    id: "vehicle_change_insurance",
    label: "PPV Insurance for new vehicle",
    hint: "Comprehensive insurance covering public passenger vehicle use.",
    required: true,
  },
];

export default function DriverVehicleChangePage() {
  const [latest, setLatest] = useState<ChangeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [spec, setSpec] = useState<VehicleSpec>(EMPTY_VEHICLE_SPEC);
  const [plate, setPlate] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<FileState>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const [
          {
            data: { user },
          },
          changeRes,
        ] = await Promise.all([
          supabase.auth.getUser(),
          fetch("/api/driver/vehicle-change"),
        ]);
        if (cancelled) return;
        setUserId(user?.id ?? null);
        if (changeRes.ok) {
          const json = (await changeRes.json()) as {
            request: ChangeRequest | null;
          };
          setLatest(json.request);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePickFile = async (docId: string, file: File) => {
    if (!userId) {
      setError("You're not signed in.");
      return;
    }
    // Optimistic placeholder so the UI shows "Uploading..." immediately.
    setFiles((prev) => ({
      ...prev,
      [docId]: { name: file.name, size: file.size, uploading: true },
    }));
    const result = await uploadDriverDocument({
      userId,
      docKey: docId,
      file,
    });
    if ("error" in result) {
      setFiles((prev) => ({
        ...prev,
        [docId]: { name: file.name, size: file.size, error: result.error },
      }));
    } else {
      setFiles((prev) => ({
        ...prev,
        [docId]: { name: file.name, size: file.size, path: result.path },
      }));
    }
  };

  const handleRemoveFile = async (docId: string) => {
    const existing = files[docId];
    if (existing?.path) await removeDriverDocument(existing.path);
    setFiles((prev) => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });
  };

  const allDocsUploaded = REQUIRED_DOCS.every(
    (d) => !!files[d.id]?.path,
  );
  const specComplete =
    !!spec.type && !!spec.brand && !!spec.model && !!spec.year && !!spec.color;
  const canSubmit = specComplete && allDocsUploaded && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/driver/vehicle-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: spec.type,
          brand: spec.brand,
          model: spec.model,
          year: Number(spec.year),
          color: spec.color,
          plate: plate.trim() || null,
          note: note.trim() || null,
          registrationPath: files.vehicle_change_registration?.path,
          cofPath: files.vehicle_change_cof?.path,
          insurancePath: files.vehicle_change_insurance?.path,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Server returned ${res.status}`);
      }
      // Reload to flip into the pending state.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit.");
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this vehicle change request?")) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch("/api/driver/vehicle-change", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel.");
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 px-2 py-6 md:px-3 md:py-8">
        <div className="rounded-3xl bg-rajlo-black p-6 md:p-8">
          <Skeleton variant="dark" className="h-3 w-32" rounded="full" />
          <Skeleton
            variant="dark"
            className="mt-3 h-9 w-3/4 max-w-64"
            rounded="lg"
          />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <Skeleton className="h-3 w-32" rounded="md" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" rounded="xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Pending state ───
  if (latest && latest.status === "pending") {
    return (
      <div className="mx-auto max-w-3xl space-y-5 px-2 py-6 md:px-3 md:py-8">
        <FadeUp>
          <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-6 text-white shadow-xl shadow-rajlo-black/30 md:p-8">
            <ArcWatermark
              size={360}
              variant="red"
              className="absolute -right-20 -bottom-24 opacity-[0.18]"
            />
            <div className="relative">
              <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                Vehicle change request
              </p>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                Awaiting review
              </h1>
              <p className="mt-2 max-w-md text-sm text-white/80">
                We&apos;ve received your request. Our compliance team
                typically reviews within 1–2 business days. You can keep
                driving your current vehicle in the meantime.
              </p>
            </div>
          </div>
        </FadeUp>

        <FadeUp delay={0.06}>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
              Requested vehicle
            </p>
            <p className="mt-2 text-base font-extrabold tracking-tight">
              {latest.requested_year} {latest.requested_color}{" "}
              {latest.requested_brand} {latest.requested_model}
            </p>
            <p className="mt-1 text-xs text-muted">
              {latest.requested_type}
              {latest.requested_plate
                ? ` · plate ${latest.requested_plate}`
                : ""}
            </p>
            {latest.note && (
              <div className="mt-4 rounded-xl bg-surface-soft p-3">
                <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
                  Your note
                </p>
                <p className="mt-1 text-sm">{latest.note}</p>
              </div>
            )}
            <p className="mt-4 text-[11px] text-muted">
              Submitted{" "}
              {new Date(latest.submitted_at).toLocaleString("en-JM", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </FadeUp>

        {error && (
          <div className="rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm font-semibold text-rajlo-red">
            {error}
          </div>
        )}

        <FadeUp delay={0.1}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-bold text-foreground transition-all hover:-translate-y-0.5 hover:bg-surface-soft disabled:opacity-60"
            >
              {cancelling ? "Cancelling…" : "Cancel request"}
            </button>
            <Link
              href="/driver/profile"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-rajlo-red px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
            >
              Back to profile
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </div>
        </FadeUp>
      </div>
    );
  }

  // ─── Form state (no pending request, OR last one was approved/
  //     rejected/cancelled and they want to try again) ───
  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-3xl space-y-5 px-2 py-6 md:px-3 md:py-8"
    >
      {/* Hero */}
      <FadeUp>
        <div className="relative overflow-hidden rounded-3xl bg-rajlo-red p-6 text-white shadow-xl shadow-rajlo-red/30 md:p-8">
          <ArcWatermark
            size={360}
            variant="white"
            className="absolute -right-20 -bottom-24 opacity-[0.10]"
          />
          <div className="relative">
            <p className="font-secondary text-xs font-bold uppercase tracking-wider text-white/85">
              Request vehicle change
            </p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              Tell us about your new car
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/85">
              Pick the new vehicle from the list, upload its registration,
              COF and insurance, and we&apos;ll review within 1–2 business
              days.
            </p>
          </div>
        </div>
      </FadeUp>

      {/* Last rejected note (if any) */}
      {latest && latest.status === "rejected" && latest.admin_note && (
        <FadeUp delay={0.04}>
          <div className="rounded-2xl border border-rajlo-red/30 bg-primary-soft px-5 py-4">
            <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
              Previous request rejected
            </p>
            <p className="mt-1 text-sm font-bold">
              {latest.admin_note}
            </p>
            <p className="mt-1 text-xs text-muted">
              Address the issue above and resubmit.
            </p>
          </div>
        </FadeUp>
      )}

      {error && (
        <div className="rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm font-semibold text-rajlo-red">
          {error}
        </div>
      )}

      {/* Vehicle spec */}
      <FadeUp delay={0.06}>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
            New vehicle
          </p>
          <p className="mt-1 mb-4 text-xs text-muted">
            Pick from the catalog so the spec matches what we&apos;ll
            verify against your documents.
          </p>
          <VehiclePicker value={spec} onChange={setSpec} />
          <div className="mt-4">
            <label className="block">
              <span className="text-xs font-semibold text-muted">
                New plate number{" "}
                <span className="ml-1 text-[10px] font-medium text-muted/70">
                  optional
                </span>
              </span>
              <input
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="5812 GK"
                className="mt-1 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none transition-all placeholder:text-muted/70 focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15"
              />
              <p className="mt-1 text-[11px] text-muted">
                Only fill if the plate has changed too. Otherwise leave blank.
              </p>
            </label>
          </div>
        </div>
      </FadeUp>

      {/* Documents */}
      <FadeUp delay={0.1}>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
            Compliance documents
          </p>
          <p className="mt-1 mb-4 text-xs text-muted">
            All three are required and must be in-date for the new vehicle.
            We&apos;ll match them against the spec above.
          </p>
          <div className="space-y-4">
            {REQUIRED_DOCS.map((doc) => (
              <FileUpload
                key={doc.id}
                field={doc}
                files={files}
                onPick={handlePickFile}
                onRemove={handleRemoveFile}
              />
            ))}
          </div>
        </div>
      </FadeUp>

      {/* Note */}
      <FadeUp delay={0.14}>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <label className="block">
            <span className="text-sm font-semibold">
              Note for the reviewer{" "}
              <span className="ml-1 text-xs font-medium text-muted">
                optional
              </span>
            </span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Sold the old car, this is the replacement…"
              className="mt-2 w-full rounded-xl border border-line bg-surface-soft px-4 py-3 text-sm outline-none transition-all placeholder:text-muted/70 focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15"
            />
            <p className="mt-1 text-[11px] text-muted">
              Helps the reviewer process your request faster.
            </p>
          </label>
        </div>
      </FadeUp>

      {/* Action bar */}
      <FadeUp delay={0.18}>
        <div className="sticky bottom-0 z-10 -mx-2 flex flex-col gap-2 border-t border-line bg-surface/95 px-2 py-3 backdrop-blur md:relative md:mx-0 md:rounded-2xl md:border md:px-5 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted">
              {!specComplete
                ? "Pick all vehicle fields to continue."
                : !allDocsUploaded
                  ? "Upload all three documents to continue."
                  : "Ready to submit for review."}
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:-translate-y-0"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Submitting…
                </>
              ) : (
                <>
                  Submit for review
                  <Icon name="arrow-right" className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </FadeUp>
    </form>
  );
}
