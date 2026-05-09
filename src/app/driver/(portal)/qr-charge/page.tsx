"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Icon } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp } from "@/components/anim";
import { useBackgroundRefresh } from "@/lib/use-background-refresh";
import { formatJMD } from "@/lib/jamaica";

/**
 * /driver/qr-charge — Driver-initiated QR pay.
 *
 * Driver enters an amount, taps "Generate QR", and gets a high-contrast
 * code on screen. The rider scans it (camera or manual paste); the
 * driver UI polls /api/driver/qr/[id] every 2s and flips to a success
 * state the moment the rider confirms.
 */

type ChargeState =
  | { kind: "idle"; error: string | null }
  | { kind: "creating" }
  | {
      kind: "live";
      id: string;
      code: string;
      amountJmd: number;
      qrPayload: string;
      qrDataUrl: string | null;
      expiresAt: string;
    }
  | {
      kind: "paid";
      amountJmd: number;
      driverEarningsJmd: number | null;
      payerName: string | null;
    }
  | { kind: "expired"; amountJmd: number }
  | { kind: "cancelled" };

const QUICK_AMOUNTS = [200, 500, 1000, 2000, 5000];

export default function DriverQrChargePage() {
  const [amountInput, setAmountInput] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<ChargeState>({ kind: "idle", error: null });

  const amountJmd = useMemo(() => {
    const n = Number(amountInput.replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }, [amountInput]);

  const generate = async () => {
    if (amountJmd < 50) {
      setState({ kind: "idle", error: "Minimum charge is JMD $50." });
      return;
    }
    setState({ kind: "creating" });
    try {
      const res = await fetch("/api/driver/qr/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountJmd,
          description: description.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        charge?: {
          id: string;
          code: string;
          amountJmd: number;
          qrPayload: string;
          expiresAt: string;
        };
        error?: string;
      };
      if (!res.ok || !json.ok || !json.charge) {
        throw new Error(json.error ?? "Couldn't create QR");
      }

      // Render QR client-side. The library outputs a data URL we can
      // drop into an <img> — keeps the SVG generation off the server.
      const qrDataUrl = await QRCode.toDataURL(json.charge.qrPayload, {
        margin: 1,
        width: 480,
        color: { dark: "#0a0a0a", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });

      setState({
        kind: "live",
        id: json.charge.id,
        code: json.charge.code,
        amountJmd: json.charge.amountJmd,
        qrPayload: json.charge.qrPayload,
        qrDataUrl,
        expiresAt: json.charge.expiresAt,
      });
    } catch (e) {
      setState({
        kind: "idle",
        error: e instanceof Error ? e.message : "Couldn't create QR.",
      });
    }
  };

  // Live poll while a charge is on screen.
  const pollOnce = useCallback(async () => {
    if (state.kind !== "live") return;
    try {
      const res = await fetch(`/api/driver/qr/${state.id}`);
      if (!res.ok) return;
      const json = (await res.json()) as {
        charge: {
          status: "pending" | "confirmed" | "expired" | "cancelled";
          amountJmd: number;
          driverEarningsJmd: number | null;
          payerName: string | null;
        };
      };
      if (json.charge.status === "confirmed") {
        setState({
          kind: "paid",
          amountJmd: json.charge.amountJmd,
          driverEarningsJmd: json.charge.driverEarningsJmd,
          payerName: json.charge.payerName,
        });
      } else if (json.charge.status === "expired") {
        setState({ kind: "expired", amountJmd: json.charge.amountJmd });
      } else if (json.charge.status === "cancelled") {
        setState({ kind: "cancelled" });
      }
    } catch {
      /* polling — next tick will catch up */
    }
  }, [state]);

  useBackgroundRefresh(pollOnce, 2000, { enabled: state.kind === "live" });

  // Countdown ticker. Only renders/updates while live.
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (state.kind !== "live") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    setNow(Date.now());
    intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.kind]);

  const cancelLive = async () => {
    if (state.kind !== "live") return;
    try {
      await fetch(`/api/driver/qr/${state.id}`, { method: "DELETE" });
    } catch {
      /* even if this fails, the UI should reset */
    }
    setState({ kind: "cancelled" });
  };

  const reset = () => {
    setAmountInput("");
    setDescription("");
    setState({ kind: "idle", error: null });
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
              Charge any rider, instantly
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/75 md:text-base">
              Type the amount, show the QR. Money lands in your wallet the
              second they confirm — no cash, no chasing.
            </p>
          </div>
        </section>
      </FadeUp>

      {state.kind === "idle" && (
        <FadeUp delay={0.05}>
          <ChargeComposer
            amountInput={amountInput}
            setAmountInput={setAmountInput}
            description={description}
            setDescription={setDescription}
            onGenerate={generate}
            error={state.error}
          />
        </FadeUp>
      )}

      {state.kind === "creating" && (
        <FadeUp delay={0.05}>
          <div className="rounded-3xl border border-line bg-surface p-10 text-center">
            <span className="mx-auto inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-rajlo-red border-t-transparent" />
            <p className="mt-4 text-sm font-bold">Generating QR…</p>
          </div>
        </FadeUp>
      )}

      {state.kind === "live" && (
        <FadeUp delay={0.05}>
          <LiveQrCard
            amountJmd={state.amountJmd}
            code={state.code}
            qrDataUrl={state.qrDataUrl}
            expiresAt={state.expiresAt}
            now={now}
            onCancel={cancelLive}
          />
        </FadeUp>
      )}

      {state.kind === "paid" && (
        <FadeUp delay={0.05}>
          <PaidCard state={state} onReset={reset} />
        </FadeUp>
      )}

      {(state.kind === "expired" || state.kind === "cancelled") && (
        <FadeUp delay={0.05}>
          <EndedCard state={state} onReset={reset} />
        </FadeUp>
      )}
    </div>
  );
}

/* ════════════ Composer ════════════ */

function ChargeComposer({
  amountInput,
  setAmountInput,
  description,
  setDescription,
  onGenerate,
  error,
}: {
  amountInput: string;
  setAmountInput: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  onGenerate: () => void;
  error: string | null;
}) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-6 md:p-8">
      <p className="font-secondary text-[11px] font-bold uppercase tracking-wider text-rajlo-red">
        Amount
      </p>
      <h2 className="mt-1 text-xl font-extrabold tracking-tight md:text-2xl">
        How much is the rider paying?
      </h2>

      <div className="mt-5">
        <label className="relative block">
          <span className="sr-only">Amount in JMD</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-extrabold text-muted">
            JMD $
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
            className="block w-full rounded-2xl border-2 border-line bg-surface-soft py-5 pl-20 pr-4 text-3xl font-extrabold tracking-tight outline-none focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15 md:text-4xl"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK_AMOUNTS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAmountInput(String(v))}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-muted hover:border-rajlo-red hover:text-rajlo-red"
          >
            {formatJMD(v)}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <label htmlFor="qr-description" className="block">
          <span className="font-secondary text-[11px] font-bold uppercase tracking-wider text-muted">
            Note (optional)
          </span>
          <input
            id="qr-description"
            type="text"
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Round 2 fare · Half Way Tree → Cross Roads"
            className="mt-1.5 block w-full rounded-xl border border-line bg-surface-soft px-4 py-3 text-sm font-medium outline-none focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15"
          />
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm text-rajlo-red">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onGenerate}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-rajlo-red px-6 py-4 text-base font-bold text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover sm:w-auto"
      >
        Generate QR
        <Icon name="arrow-right" className="h-4 w-4" />
      </button>
    </section>
  );
}

/* ════════════ Live QR ════════════ */

function LiveQrCard({
  amountJmd,
  code,
  qrDataUrl,
  expiresAt,
  now,
  onCancel,
}: {
  amountJmd: number;
  code: string;
  qrDataUrl: string | null;
  expiresAt: string;
  now: number;
  onCancel: () => void;
}) {
  const remainingSec = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - now) / 1000),
  );
  const mm = Math.floor(remainingSec / 60);
  const ss = String(remainingSec % 60).padStart(2, "0");

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="bg-rajlo-black p-6 text-center text-white md:p-7">
        <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
          Show this to the rider
        </p>
        <p className="mt-2 text-5xl font-extrabold tracking-tight md:text-6xl">
          {formatJMD(amountJmd)}
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
          </span>
          Waiting for rider · {mm}:{ss}
        </div>
      </div>

      <div className="grid place-items-center bg-surface px-6 py-8 md:py-10">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt={`Scan this QR to pay ${formatJMD(amountJmd)}`}
            className="h-auto w-full max-w-[320px] rounded-2xl border border-line bg-white p-3 shadow-md"
          />
        ) : (
          <div className="grid h-[320px] w-[320px] place-items-center rounded-2xl border border-line bg-surface-soft">
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-rajlo-red border-t-transparent" />
          </div>
        )}

        <div className="mt-5 text-center">
          <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
            Or type code on rider phone
          </p>
          <p className="mt-1 select-all font-mono text-2xl font-extrabold tracking-[0.3em]">
            {code}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-soft px-5 py-4 text-xs text-muted">
        <p>
          QR expires in <span className="font-bold text-foreground">{mm}:{ss}</span>.
          Polling every 2 seconds.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-muted hover:border-rajlo-red hover:text-rajlo-red"
        >
          Cancel charge
        </button>
      </div>
    </section>
  );
}

/* ════════════ Paid ════════════ */

function PaidCard({
  state,
  onReset,
}: {
  state: { amountJmd: number; driverEarningsJmd: number | null; payerName: string | null };
  onReset: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-300 bg-emerald-50">
      <div className="px-6 py-8 text-center md:py-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
          <Icon name="check-circle" className="h-7 w-7" />
        </span>
        <p className="font-secondary mt-5 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
          Paid
        </p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight text-emerald-900 md:text-5xl">
          {formatJMD(state.amountJmd)}
        </p>
        {state.payerName && (
          <p className="mt-2 text-sm text-emerald-900/85">
            From {state.payerName}
          </p>
        )}
        {state.driverEarningsJmd !== null && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-emerald-900">
            <Icon name="wallet" className="h-3.5 w-3.5" />
            +{formatJMD(state.driverEarningsJmd)} to your wallet
          </p>
        )}
      </div>
      <div className="flex justify-center gap-3 border-t border-emerald-200 bg-white px-5 py-4">
        <Link
          href="/driver/wallet"
          className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-soft"
        >
          Open wallet
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full bg-rajlo-red px-5 py-2 text-xs font-bold text-white shadow-md shadow-rajlo-red/25 hover:-translate-y-0.5 hover:bg-primary-hover"
        >
          New charge
        </button>
      </div>
    </section>
  );
}

/* ════════════ Expired / cancelled ════════════ */

function EndedCard({
  state,
  onReset,
}: {
  state: { kind: "expired"; amountJmd: number } | { kind: "cancelled" };
  onReset: () => void;
}) {
  const isExpired = state.kind === "expired";
  return (
    <section className="rounded-3xl border border-line bg-surface p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-soft text-muted">
        <Icon name="clock" className="h-6 w-6" />
      </span>
      <p className="mt-4 text-base font-extrabold">
        {isExpired ? "Charge expired" : "Charge cancelled"}
      </p>
      <p className="mt-1 text-xs text-muted">
        {isExpired
          ? `${formatJMD((state as { amountJmd: number }).amountJmd)} timed out before the rider scanned. Try again.`
          : "You cancelled before the rider scanned."}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-rajlo-red px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-rajlo-red/25 hover:-translate-y-0.5 hover:bg-primary-hover"
      >
        New charge
        <Icon name="arrow-right" className="h-4 w-4" />
      </button>
    </section>
  );
}
