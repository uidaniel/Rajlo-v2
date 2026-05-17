"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./icons";

/**
 * OTP-gated policy editor (client side of /admin/legal/[key]).
 *
 * Flow:
 *   1. "edit"  — the admin edits title / version / effective date /
 *                summary / body, then clicks "Save changes".
 *   2. "otp"   — POST /request mails a 6-digit code; the admin enters
 *                it. POST /confirm publishes the edit.
 *   3. "done"  — confirmation; the policy is live.
 *
 * Nothing is published until the OTP is confirmed, so a single
 * compromised admin session can't silently rewrite a policy.
 */

type Stage = "edit" | "otp" | "done";

type InitialDoc = {
  title: string;
  version: string;
  effectiveDate: string;
  summary: string;
  body: string;
};

export function AdminLegalEditor({
  docKey,
  initial,
  source,
}: {
  docKey: string;
  initial: InitialDoc;
  source: "db" | "baseline";
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("edit");

  const [title, setTitle] = useState(initial.title);
  const [version, setVersion] = useState(initial.version);
  const [effectiveDate, setEffectiveDate] = useState(initial.effectiveDate);
  const [summary, setSummary] = useState(initial.summary);
  const [body, setBody] = useState(initial.body);

  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const versionChanged = version.trim() !== initial.version.trim();

  const canSave =
    title.trim() &&
    version.trim() &&
    /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) &&
    summary.trim() &&
    body.trim().length >= 50;

  // Step 1 — request the OTP.
  const requestOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/legal/${docKey}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, version, effectiveDate, summary, body }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        sentTo?: string;
      };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSentTo(json.sentTo ?? "your email");
      setOtp("");
      setStage("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the code.");
    } finally {
      setBusy(false);
    }
  };

  // Step 2 — confirm the OTP and publish.
  const confirmOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/legal/${docKey}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setStage("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't confirm the code.");
    } finally {
      setBusy(false);
    }
  };

  if (stage === "done") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-600 text-white">
          <Icon name="check-circle" className="h-6 w-6" />
        </div>
        <h2 className="mt-3 text-lg font-extrabold text-emerald-900">
          Policy published
        </h2>
        <p className="mt-1 text-sm text-emerald-800">
          The updated policy is now live. {versionChanged
            ? "Because the version changed, every affected user will be asked to re-accept it."
            : "The version was unchanged, so users keep their existing acceptance."}
        </p>
      </div>
    );
  }

  if (stage === "otp") {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rajlo-red/10 text-rajlo-red">
          <Icon name="shield-check" className="h-6 w-6" />
        </div>
        <h2 className="mt-3 text-center text-lg font-extrabold tracking-tight">
          Enter your verification code
        </h2>
        <p className="mt-1 text-center text-sm text-muted">
          We sent a 6-digit code to{" "}
          <span className="font-bold text-foreground">{sentTo}</span>. Enter
          it to publish this policy.
        </p>

        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="mx-auto mt-5 block w-48 rounded-xl border border-line bg-background py-3 text-center text-2xl font-extrabold tracking-[0.4em] focus:border-rajlo-red focus:outline-none"
        />

        {error && (
          <p className="mt-3 text-center text-xs font-semibold text-rajlo-red">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={otp.length !== 6 || busy}
            onClick={confirmOtp}
            className="inline-flex w-full items-center justify-center rounded-full bg-rajlo-red px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? "Publishing…" : "Confirm & publish"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setStage("edit");
              setError(null);
            }}
            className="inline-flex w-full items-center justify-center rounded-full border border-line bg-background px-5 py-3 text-sm font-bold text-foreground hover:bg-surface-2"
          >
            Back to editing
          </button>
        </div>
      </div>
    );
  }

  // stage === "edit"
  return (
    <div className="space-y-4">
      {source === "baseline" && (
        <p className="rounded-xl border border-line bg-surface-soft px-4 py-3 text-xs text-muted">
          This policy is still on its committed baseline — your first
          published edit becomes the live copy.
        </p>
      )}

      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm focus:border-rajlo-red focus:outline-none"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Version"
          hint="Change this to require all affected users to re-accept."
        >
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm focus:border-rajlo-red focus:outline-none"
          />
        </Field>
        <Field label="Effective date">
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm focus:border-rajlo-red focus:outline-none"
          />
        </Field>
      </div>

      <Field label="Summary" hint="One line, shown in the legal index + consent screens.">
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={300}
          className="w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm focus:border-rajlo-red focus:outline-none"
        />
      </Field>

      <Field
        label="Policy text"
        hint='Lines like "1. Heading" and "2.1 Heading" become section headings; a line ending in ":" starts a bullet list.'
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={20}
          className="w-full rounded-xl border border-line bg-background px-3.5 py-3 font-mono text-xs leading-relaxed focus:border-rajlo-red focus:outline-none"
        />
      </Field>

      {versionChanged && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          Version changed ({initial.version} → {version}). On publish,
          every {docKey.startsWith("driver-") ? "driver" : "affected user"}{" "}
          will be required to re-accept this policy.
        </p>
      )}

      {error && (
        <p className="text-xs font-semibold text-rajlo-red">{error}</p>
      )}

      <button
        type="button"
        disabled={!canSave || busy}
        onClick={requestOtp}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rajlo-red px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
      >
        <Icon name="shield-check" className="h-4 w-4" />
        {busy ? "Sending code…" : "Save changes — send verification code"}
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-muted">
        {label}
      </span>
      {hint && <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
