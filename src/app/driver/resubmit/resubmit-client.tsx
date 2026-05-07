"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { ArcWatermark } from "@/components/arc-pattern";
import { Icon } from "@/components/icons";
import { FadeUp } from "@/components/anim";
import { FileUpload, type FileState } from "@/components/file-upload";
import { SignOutButton } from "@/components/sign-out-button";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { uploadDriverDocument, removeDriverDocument } from "@/lib/storage";

export type RejectedDocCard = {
  id: string;
  label: string;
  description: string;
  adminNote: string | null;
};

const DRAFT_KEY = "rajlo-driver-onboarding-draft";

export function ResubmitClient({
  adminNote,
  rejectedDocs,
}: {
  adminNote: string | null;
  rejectedDocs: RejectedDocCard[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileState>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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

  // Hydrate from the wizard's shared draft. If the user uploaded a file in
  // the wizard's edit mode and then came over here (or a prior session left
  // uploads in flight), pre-populate them so they don't have to re-upload.
  // Only docs that are still in the rejected set apply.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as { files?: FileState };
      if (!draft.files) return;
      const rejectedIds = new Set(rejectedDocs.map((d) => d.id));
      const restored: FileState = {};
      Object.entries(draft.files).forEach(([k, v]) => {
        if (v?.path && rejectedIds.has(k)) {
          restored[k] = { name: v.name, size: v.size, path: v.path };
        }
      });
      if (Object.keys(restored).length > 0) {
        setFiles((prev) => ({ ...restored, ...prev }));
      }
    } catch {
      /* corrupted draft — ignore */
    }
  }, [rejectedDocs]);

  // Mirror in-flight uploads to the wizard's draft so navigating to
  // "Edit my details" restores them on the wizard side.
  useEffect(() => {
    if (done) return;
    try {
      const persistable: FileState = {};
      Object.entries(files).forEach(([k, v]) => {
        if (v?.path) {
          persistable[k] = { name: v.name, size: v.size, path: v.path };
        }
      });
      const raw = localStorage.getItem(DRAFT_KEY);
      const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const existingFiles =
        (existing.files as FileState | undefined) ?? ({} as FileState);
      const next = {
        ...existing,
        files: { ...existingFiles, ...persistable },
        savedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      /* localStorage full or disabled — non-fatal */
    }
  }, [files, done]);

  const handlePickFile = async (docKey: string, file: File) => {
    if (!userId) {
      setFiles((prev) => ({
        ...prev,
        [docKey]: { name: file.name, size: file.size, error: "Not signed in" },
      }));
      return;
    }

    const previousPath = files[docKey]?.path;

    setFiles((prev) => ({
      ...prev,
      [docKey]: { name: file.name, size: file.size, uploading: true },
    }));

    const result = await uploadDriverDocument({ userId, docKey, file });

    if ("error" in result) {
      setFiles((prev) => ({
        ...prev,
        [docKey]: { name: file.name, size: file.size, error: result.error },
      }));
      return;
    }

    setFiles((prev) => ({
      ...prev,
      [docKey]: { name: file.name, size: file.size, path: result.path },
    }));

    if (previousPath && previousPath !== result.path) {
      removeDriverDocument(previousPath).catch(() => {});
    }
  };

  const handleRemoveFile = async (docKey: string) => {
    const current = files[docKey];
    if (current?.path) {
      removeDriverDocument(current.path).catch(() => {});
    }
    setFiles((prev) => {
      const next = { ...prev };
      delete next[docKey];
      return next;
    });
  };

  const allUploaded = rejectedDocs.every((d) => Boolean(files[d.id]?.path));
  const anyUploading = Object.values(files).some((f) => f?.uploading);
  const uploadedCount = rejectedDocs.filter((d) =>
    Boolean(files[d.id]?.path),
  ).length;

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (anyUploading) {
        setSubmitError("Please wait for all uploads to finish.");
        setSubmitting(false);
        return;
      }

      const uploadedDocs = Object.entries(files)
        .filter(([, file]) => file?.path)
        .map(([id, file]) => ({
          id,
          fileName: file!.name,
          filePath: file!.path,
        }));

      const res = await fetch("/api/driver/resubmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadedDocs }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "Failed");
      }
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* */
      }
      setDone(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Resubmission failed.");
    } finally {
      setSubmitting(false);
    }
  };

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
          <h1 className="mt-8 text-4xl font-extrabold tracking-tight md:text-5xl">
            Documents resubmitted
          </h1>
        </FadeUp>
        <FadeUp delay={0.2}>
          <p className="mx-auto mt-4 max-w-md text-base text-muted">
            Our operations team will re-review your application within 1–2
            business days. You&apos;ll get an email the moment a decision is made.
          </p>
        </FadeUp>
        <FadeUp delay={0.3}>
          <button
            onClick={() => router.push("/driver/pending")}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-rajlo-red px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
          >
            Track verification status
            <Icon name="arrow-right" className="h-4 w-4" />
          </button>
        </FadeUp>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-soft">
      {/* ────── Top bar ────── */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4">
          <Logo size="sm" tagline />
          <SignOutButton />
        </div>
      </header>

      {/* ────── Body ────── */}
      <div className="relative mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:px-6 md:py-12">
        <ArcWatermark
          size={520}
          variant="red"
          className="absolute -right-32 -top-10 opacity-[0.04]"
        />

        {/* Hero */}
        <FadeUp>
          <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
            Resubmission
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
            Re-upload {rejectedDocs.length} document
            {rejectedDocs.length === 1 ? "" : "s"}
          </h1>
          <p className="mt-2 text-sm text-muted md:text-base">
            Only the documents flagged below need attention. Your form details
            and previously approved files are still saved.
          </p>
        </FadeUp>

        {/* Admin note */}
        {adminNote && (
          <FadeUp delay={0.05}>
            <div className="relative mt-6 overflow-hidden rounded-2xl border border-rajlo-red/30 bg-primary-soft p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rajlo-red text-white">
                  <Icon name="alert-triangle" className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-secondary text-[11px] font-bold uppercase tracking-wider text-rajlo-red">
                    Note from operations
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-rajlo-black">
                    {adminNote}
                  </p>
                </div>
              </div>
            </div>
          </FadeUp>
        )}

        {/* Doc cards */}
        <div className="mt-6 space-y-4">
          {rejectedDocs.map((doc, i) => (
            <FadeUp key={doc.id} delay={0.05 * i}>
              <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm shadow-rajlo-red/[0.03] md:p-7">
                {doc.description && (
                  <p className="mb-3 text-xs leading-relaxed text-muted">
                    {doc.description}
                  </p>
                )}
                {doc.adminNote && (
                  <div className="mb-4 rounded-xl bg-primary-soft px-4 py-3">
                    <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                      Why it was flagged
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-rajlo-black">
                      {doc.adminNote}
                    </p>
                  </div>
                )}
                <FileUpload
                  field={{ id: doc.id, label: doc.label, required: true }}
                  files={files}
                  onPick={handlePickFile}
                  onRemove={handleRemoveFile}
                />
              </div>
            </FadeUp>
          ))}
        </div>

        {/* Edit my details escape hatch */}
        <FadeUp delay={0.15}>
          <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-4">
            <div>
              <p className="text-sm font-bold">Need to fix something else?</p>
              <p className="mt-0.5 text-xs text-muted">
                Open the full application to edit personal details or vehicle
                info.
              </p>
            </div>
            <Link
              href="/driver/onboarding?edit=1"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-soft px-4 py-2 text-xs font-bold text-foreground hover:border-rajlo-red hover:bg-primary-soft hover:text-rajlo-red"
            >
              Edit my details
              <Icon name="arrow-right" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </FadeUp>

        {submitError && (
          <div className="mt-5 rounded-xl border border-rajlo-red/20 bg-primary-soft px-4 py-3 text-sm text-rajlo-red">
            {submitError}
          </div>
        )}
      </div>

      {/* ────── Sticky action bar ────── */}
      <footer className="sticky bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
          <p className="text-xs font-semibold text-muted">
            {uploadedCount} of {rejectedDocs.length} uploaded
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !allUploaded || anyUploading}
            title={
              !allUploaded
                ? "Re-upload every flagged document to continue"
                : undefined
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-rajlo-red px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-rajlo-red/20 transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:-translate-y-0"
          >
            {submitting ? "Resubmitting…" : "Submit resubmission"}
            {!submitting && <Icon name="check-circle" className="h-4 w-4" />}
          </button>
        </div>
      </footer>
    </div>
  );
}
