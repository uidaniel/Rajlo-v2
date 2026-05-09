"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp } from "@/components/anim";
import { Skeleton } from "@/components/skeleton";
import { formatJMD } from "@/lib/jamaica";

/**
 * /rider/qr-pay — Rider confirms a QR pay charge created by a driver.
 *
 * Two ways in:
 *   1. URL deep-link (`?code=ABCD1234`) — phone camera scanned the QR.
 *   2. Manual entry — type / paste the 8-char code from the driver's
 *      screen.
 *
 * Flow:
 *   enter code → preview (driver, amount, balance check) → confirm →
 *   paid (new balance + receipt link) | needs-top-up | error
 */

type Preview = {
  charge: {
    id: string;
    code: string;
    amountJmd: number;
    description: string | null;
    expiresAt: string;
    driver: {
      firstName: string | null;
      lastName: string | null;
      plateNumber: string | null;
      vehicleMake: string | null;
      vehicleModel: string | null;
      vehicleColor: string | null;
    };
  };
  wallet: { balanceJmd: number; sufficient: boolean; shortfallJmd: number };
};

type ScreenState =
  | { kind: "input"; error: string | null }
  // The `code` is part of the loading variant so the effect that drives
  // the actual fetch can read it without needing a separate ref + the
  // React-19 "no setState in effects" rule stays happy.
  | { kind: "loading"; code: string }
  | { kind: "preview"; preview: Preview }
  | { kind: "confirming"; preview: Preview }
  | { kind: "paid"; amountJmd: number; balanceAfter: number }
  | { kind: "error"; title: string; message: string; canRetry: boolean };

export default function RiderQrPayPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RiderQrPayInner />
    </Suspense>
  );
}

function RiderQrPayInner() {
  const params = useSearchParams();
  const initialCode = (params.get("code") ?? "").toUpperCase();

  const [code, setCode] = useState(initialCode);
  const [state, setState] = useState<ScreenState>(
    initialCode && initialCode.length === 8
      ? { kind: "loading", code: initialCode }
      : { kind: "input", error: null },
  );

  // Trigger handlers just transition state to "loading"; the effect
  // below owns the actual network call. This dance keeps the React-19
  // no-setState-in-effect rule happy without sacrificing the auto-load
  // on deep-link arrival.
  const startLookup = useCallback((raw: string) => {
    const cleaned = raw.trim().toUpperCase();
    if (cleaned.length !== 8) {
      setState({
        kind: "input",
        error: "Code is exactly 8 characters — check the driver's screen.",
      });
      return;
    }
    setState({ kind: "loading", code: cleaned });
  }, []);

  // Effect runs whenever we enter the "loading" state. Cancellable so
  // a fast second submit doesn't race a stale first response into view.
  useEffect(() => {
    if (state.kind !== "loading") return;
    const lookupCode = state.code;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/rider/qr/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: lookupCode }),
        });
        const json = (await res.json().catch(() => ({}))) as Preview & {
          error?: string;
          message?: string;
        };
        if (cancelled) return;
        if (res.ok && json.charge) {
          setState({ kind: "preview", preview: json });
          return;
        }
        setState({
          kind: "error",
          title:
            json.error === "code_not_found"
              ? "Code not found"
              : json.error === "no_longer_valid"
                ? "Charge no longer valid"
                : json.error === "already_paid"
                  ? "Already paid"
                  : json.error === "self_pay"
                    ? "Can't pay yourself"
                    : "Couldn't load that charge",
          message: json.message ?? "Try the code again or ask the driver.",
          canRetry: true,
        });
      } catch {
        if (cancelled) return;
        setState({
          kind: "error",
          title: "Network error",
          message: "Check your connection and try again.",
          canRetry: true,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state]);

  const confirm = async () => {
    if (state.kind !== "preview") return;
    const previewState = state.preview;
    setState({ kind: "confirming", preview: previewState });
    try {
      const res = await fetch("/api/rider/qr/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: previewState.charge.code }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        fareJmd?: number;
        riderBalanceAfter?: number;
        error?: string;
        message?: string;
      };
      if (res.ok && json.ok) {
        setState({
          kind: "paid",
          amountJmd: json.fareJmd ?? previewState.charge.amountJmd,
          balanceAfter: json.riderBalanceAfter ?? 0,
        });
        return;
      }
      if (res.status === 402) {
        setState({
          kind: "error",
          title: "Wallet too low",
          message:
            json.message ?? "Top up your wallet, then come back to confirm.",
          canRetry: false,
        });
        return;
      }
      setState({
        kind: "error",
        title: "Couldn't confirm",
        message: json.message ?? json.error ?? "Try again in a moment.",
        canRetry: true,
      });
    } catch {
      setState({
        kind: "error",
        title: "Network error",
        message: "Check your connection and try again.",
        canRetry: true,
      });
    }
  };

  const reset = () => {
    setCode("");
    setState({ kind: "input", error: null });
  };

  return (
    <div className="space-y-6">
      <FadeUp>
        <section className="relative overflow-hidden rounded-3xl bg-rajlo-black p-7 text-white shadow-xl shadow-rajlo-black/30 md:p-10">
          <ArcWatermark
            size={520}
            variant="white"
            className="absolute -right-24 -top-24 opacity-[0.06]"
          />
          <ArcWatermark
            size={360}
            variant="red"
            className="absolute -bottom-24 -left-20 opacity-[0.16]"
          />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                QR Pay
              </span>
              <span className="h-px flex-1 bg-white/15" />
            </div>
            <h1 className="mt-3 max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
              Pay your driver in one tap
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/75 md:text-base">
              Scan the QR with your camera or type the code below. The amount
              comes straight off your Rajlo wallet — no cash exchanged.
            </p>
          </div>
        </section>
      </FadeUp>

      {state.kind === "input" && (
        <FadeUp delay={0.05}>
          <CodeEntry
            value={code}
            setValue={setCode}
            onSubmit={() => startLookup(code)}
            onScanned={(scanned) => startLookup(scanned)}
            error={state.error}
          />
        </FadeUp>
      )}

      {state.kind === "loading" && <Loading />}

      {(state.kind === "preview" || state.kind === "confirming") && (
        <FadeUp delay={0.05}>
          <PreviewCard
            preview={state.preview}
            confirming={state.kind === "confirming"}
            onConfirm={confirm}
            onCancel={reset}
          />
        </FadeUp>
      )}

      {state.kind === "paid" && (
        <FadeUp delay={0.05}>
          <PaidCard
            amountJmd={state.amountJmd}
            balanceAfter={state.balanceAfter}
            onReset={reset}
          />
        </FadeUp>
      )}

      {state.kind === "error" && (
        <FadeUp delay={0.05}>
          <ErrorCard
            title={state.title}
            message={state.message}
            onRetry={state.canRetry ? reset : null}
            showTopupCta={state.title === "Wallet too low"}
          />
        </FadeUp>
      )}
    </div>
  );
}

/* ════════════ Code entry ════════════ */

function CodeEntry({
  value,
  setValue,
  onSubmit,
  onScanned,
  error,
}: {
  value: string;
  setValue: (v: string) => void;
  onSubmit: () => void;
  onScanned: (code: string) => void;
  error: string | null;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);

  // Always render the scan CTA — the modal owns the "this browser
  // can't open the camera" path, so a feature-detect at render time
  // would just split the same fallback across two surfaces.

  return (
    <section className="rounded-3xl border border-line bg-surface p-6 md:p-8">
      <p className="font-secondary text-[11px] font-bold uppercase tracking-wider text-rajlo-red">
        Enter code
      </p>
      <h2 className="mt-1 text-xl font-extrabold tracking-tight md:text-2xl">
        Scan or type the code
      </h2>
      <p className="mt-1 text-xs text-muted">
        Your phone&apos;s camera should normally just open the QR. If it
        didn&apos;t, scan in-app or type the 8-character code.
      </p>

      <button
        type="button"
        onClick={() => setScannerOpen(true)}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rajlo-red/40 bg-primary-soft px-4 py-3 text-sm font-bold text-rajlo-red hover:border-rajlo-red sm:w-auto"
      >
        <Icon name="search" className="h-4 w-4" />
        Scan with camera
      </button>

      {scannerOpen && (
        <ScannerModal
          onClose={() => setScannerOpen(false)}
          onDetected={(scanned) => {
            setScannerOpen(false);
            onScanned(scanned);
          }}
        />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="mt-5"
      >
        <label className="block">
          <span className="sr-only">QR pay code</span>
          <input
            type="text"
            value={value}
            onChange={(e) =>
              setValue(
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 8),
              )
            }
            placeholder="ABCD1234"
            autoFocus
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="block w-full rounded-2xl border-2 border-line bg-surface-soft px-5 py-5 text-center font-mono text-3xl font-extrabold tracking-[0.5em] outline-none focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15 md:text-4xl"
          />
        </label>

        {error && (
          <p className="mt-3 rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm text-rajlo-red">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={value.length !== 8}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-rajlo-red px-6 py-4 text-base font-bold text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:-translate-y-0 sm:w-auto"
        >
          Look up code
          <Icon name="arrow-right" className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}

/* ════════════ Preview ════════════ */

function PreviewCard({
  preview,
  confirming,
  onConfirm,
  onCancel,
}: {
  preview: Preview;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { charge, wallet } = preview;
  const driverName =
    [charge.driver.firstName, charge.driver.lastName]
      .filter(Boolean)
      .join(" ") || "Your driver";
  const vehicleLine = [
    charge.driver.vehicleColor,
    charge.driver.vehicleMake,
    charge.driver.vehicleModel,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="bg-rajlo-black p-7 text-center text-white md:p-10">
        <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
          Pay {driverName}
        </p>
        <p className="mt-2 text-5xl font-extrabold tracking-tight md:text-6xl">
          {formatJMD(charge.amountJmd)}
        </p>
        {charge.description && (
          <p className="mx-auto mt-3 max-w-md text-sm text-white/75">
            &ldquo;{charge.description}&rdquo;
          </p>
        )}
        {(vehicleLine || charge.driver.plateNumber) && (
          <p className="mt-3 text-xs text-white/60">
            {vehicleLine}
            {charge.driver.plateNumber ? ` · ${charge.driver.plateNumber}` : ""}
          </p>
        )}
      </div>

      <div className="space-y-3 px-5 py-5 md:px-6">
        <div className="flex items-center justify-between rounded-2xl bg-surface-soft px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-rajlo-red shadow-sm">
              <Icon name="wallet" className="h-4 w-4" />
            </span>
            <div>
              <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
                Your wallet
              </p>
              <p className="text-sm font-extrabold">
                {formatJMD(wallet.balanceJmd)}
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
              wallet.sufficient
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-amber-50 text-amber-800 ring-amber-200"
            }`}
          >
            {wallet.sufficient
              ? "Enough to cover"
              : `Top up JMD $${wallet.shortfallJmd}`}
          </span>
        </div>

        {!wallet.sufficient && (
          <Link
            href="/rider/wallet"
            className="flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 hover:bg-amber-100"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500 text-white">
                <Icon name="wallet" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold">Top up first</p>
                <p className="text-[11px] text-amber-900/80">
                  Add at least JMD ${wallet.shortfallJmd} to confirm.
                </p>
              </div>
            </div>
            <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-soft px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold text-muted hover:bg-surface disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming || !wallet.sufficient}
          className="inline-flex items-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white shadow-md shadow-rajlo-red/25 transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:-translate-y-0"
        >
          {confirming ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-[2px] border-white border-t-transparent" />
              Paying…
            </>
          ) : (
            <>
              Pay {formatJMD(charge.amountJmd)}
              <Icon name="check-circle" className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </section>
  );
}

/* ════════════ Paid ════════════ */

function PaidCard({
  amountJmd,
  balanceAfter,
  onReset,
}: {
  amountJmd: number;
  balanceAfter: number;
  onReset: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-300 bg-emerald-50">
      <div className="px-6 py-8 text-center md:py-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
          <Icon name="check-circle" className="h-7 w-7" />
        </span>
        <p className="font-secondary mt-5 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
          Payment sent
        </p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight text-emerald-900 md:text-5xl">
          {formatJMD(amountJmd)}
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-emerald-900">
          <Icon name="wallet" className="h-3.5 w-3.5" />
          Wallet balance now {formatJMD(balanceAfter)}
        </p>
      </div>
      <div className="flex justify-center gap-3 border-t border-emerald-200 bg-white px-5 py-4">
        <Link
          href="/rider/wallet"
          className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-soft"
        >
          See receipt
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full bg-rajlo-red px-5 py-2 text-xs font-bold text-white shadow-md shadow-rajlo-red/25 hover:-translate-y-0.5 hover:bg-primary-hover"
        >
          Pay another
        </button>
      </div>
    </section>
  );
}

/* ════════════ Error ════════════ */

function ErrorCard({
  title,
  message,
  onRetry,
  showTopupCta,
}: {
  title: string;
  message: string;
  onRetry: (() => void) | null;
  showTopupCta: boolean;
}) {
  return (
    <section className="rounded-3xl border border-rajlo-red/30 bg-primary-soft p-7 text-center md:p-10">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rajlo-red text-white shadow-md shadow-rajlo-red/25">
        <Icon name="alert-triangle" className="h-6 w-6" />
      </span>
      <p className="mt-4 text-base font-extrabold tracking-tight text-rajlo-black">
        {title}
      </p>
      <p className="mt-1 text-xs text-rajlo-black/70">{message}</p>
      <div className="mt-5 flex justify-center gap-2">
        {showTopupCta && (
          <Link
            href="/rider/wallet"
            className="rounded-full bg-rajlo-red px-5 py-2 text-xs font-bold text-white shadow-md shadow-rajlo-red/25 hover:-translate-y-0.5 hover:bg-primary-hover"
          >
            Top up wallet
          </Link>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-soft"
          >
            Try another code
          </button>
        )}
      </div>
    </section>
  );
}

function Loading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-40 w-full" rounded="2xl" />
      <Skeleton className="h-24 w-full" rounded="2xl" />
    </div>
  );
}

/* ════════════ In-app camera scanner ════════════
 * Uses the native BarcodeDetector API (Chrome/Edge/Opera on Android +
 * desktop with cameras). Polls the camera stream every 500ms; on a hit
 * we extract the 8-char code from either a Rajlo URL or the raw token
 * and hand it back to the parent. Stops the camera + interval cleanly
 * on close so the LED indicator turns off.
 *
 * Falls back to the manual-entry input we already render when:
 *   - BarcodeDetector isn't supported (iOS Safari pre-2026)
 *   - User denied camera permission
 *   - getUserMedia threw (no camera, hardware in use, etc.)
 */

const CODE_PATTERN = /[A-Z0-9]{8}/;

type Window2 = Window & {
  BarcodeDetector?: new (opts: { formats: string[] }) => {
    detect: (
      source: HTMLVideoElement,
    ) => Promise<Array<{ rawValue: string }>>;
  };
};

function extractCodeFromScan(raw: string): string | null {
  const cleaned = raw.trim();
  // First pass: looks like a Rajlo deep link?
  try {
    const url = new URL(cleaned);
    const fromQuery = url.searchParams.get("code");
    if (fromQuery) {
      const m = fromQuery.toUpperCase().match(CODE_PATTERN);
      if (m) return m[0];
    }
  } catch {
    /* not a URL — fall through to raw match */
  }
  // Second pass: 8-char token anywhere in the payload (handles bare
  // codes, prefixed strings, etc.).
  const m = cleaned.toUpperCase().match(CODE_PATTERN);
  return m ? m[0] : null;
}

function ScannerModal({
  onClose,
  onDetected,
}: {
  onClose: () => void;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState("Point your camera at the QR code");

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    // All async + setState moves inside the IIFE so the effect body
    // itself stays free of state writes (React 19 lint).
    (async () => {
      const w = window as Window2;
      const Detector = w.BarcodeDetector;
      if (!Detector) {
        if (!cancelled) {
          setError("This browser can't open the camera. Type the code instead.");
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => null);
        }
        const detector = new Detector({ formats: ["qr_code"] });
        intervalId = setInterval(async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            for (const c of codes) {
              const found = extractCodeFromScan(c.rawValue);
              if (found) {
                if (intervalId) clearInterval(intervalId);
                onDetected(found);
                return;
              }
            }
            if (codes.length > 0) {
              setHint("Detected a code — keep steady…");
            }
          } catch {
            /* per-frame failure is fine; next tick retries */
          }
        }, 500);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof Error && e.name === "NotAllowedError"
            ? "Camera permission denied. Type the code instead."
            : "Couldn't open the camera. Type the code instead.";
        setError(msg);
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [onDetected]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 px-4 py-8 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-rajlo-black shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
          <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
            Scan QR
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="grid h-8 w-8 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="relative aspect-square w-full bg-black">
          {error ? (
            <div className="grid h-full place-items-center px-8 text-center text-white">
              <div>
                <Icon
                  name="alert-triangle"
                  className="mx-auto h-8 w-8 text-rajlo-red"
                />
                <p className="mt-3 text-sm font-bold">{error}</p>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* Reticle — purely decorative; positions a square in the
                  middle of the viewport so the rider knows where to aim. */}
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="h-3/5 w-3/5 rounded-2xl border-2 border-rajlo-red/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              </div>
            </>
          )}
        </div>

        <p className="px-5 py-3 text-center text-xs text-white/70">{hint}</p>
      </div>
    </div>
  );
}
