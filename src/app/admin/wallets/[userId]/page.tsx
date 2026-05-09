"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArcWatermark } from "@/components/arc-pattern";
import { Icon } from "@/components/icons";
import { FadeUp } from "@/components/anim";
import { HeroSkeleton, Skeleton } from "@/components/skeleton";
import { LiveIndicator } from "@/components/live-indicator";
import { useLiveQuery } from "@/lib/use-live-query";
import { formatJMD } from "@/lib/jamaica";

/**
 * /admin/wallets/[userId] — admin's per-user wallet detail.
 *
 * Shows the balance, full transaction list, deposit + withdrawal
 * + transfer history, and an inline "Adjust balance" composer.
 */

type Detail = {
  profile: {
    id: string;
    fullName: string;
    phone: string | null;
    role: string;
    email: string | null;
  };
  balanceJmd: number;
  transactions: Array<{
    id: string;
    direction: "credit" | "debit";
    amount_jmd: number;
    kind: string;
    description: string | null;
    balance_after_jmd: number;
    created_at: string;
  }>;
  deposits: Array<{
    id: string;
    amount_jmd: number;
    gateway: string;
    status: string;
    created_at: string;
    completed_at: string | null;
  }>;
  withdrawals: Array<{
    id: string;
    amount_jmd: number;
    bank_name: string | null;
    account_holder_name: string | null;
    status: string;
    admin_note: string | null;
    paid_at: string | null;
    created_at: string;
  }>;
  transfersSent: Array<{
    id: string;
    recipient_id: string;
    amount_jmd: number;
    status: string;
    created_at: string;
  }>;
  transfersReceived: Array<{
    id: string;
    sender_id: string;
    amount_jmd: number;
    status: string;
    created_at: string;
  }>;
};

export default function AdminWalletDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const query = useLiveQuery<Detail>(
    userId ? `/api/admin/wallets/${userId}` : null,
    { interval: 20_000 },
  );
  const [showAdjust, setShowAdjust] = useState(false);
  const data = query.data;

  if (query.loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 px-2 py-4 md:px-3 md:py-8">
        <HeroSkeleton />
        <Skeleton className="h-64 w-full" rounded="xl" />
      </div>
    );
  }
  if (query.error || !data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Icon
          name="alert-triangle"
          className="mx-auto h-10 w-10 text-rajlo-red"
        />
        <p className="mt-4 text-sm font-bold">
          {query.error ?? "User not found"}
        </p>
        <Link
          href="/admin/wallets"
          className="mt-4 inline-block text-xs font-bold text-rajlo-red hover:underline"
        >
          ← Back to wallets
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-2 py-4 md:px-3 md:py-8">
      <Link
        href="/admin/wallets"
        className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-rajlo-red"
      >
        <Icon name="chevron-left" className="h-3.5 w-3.5" />
        All wallets
      </Link>

      {/* Hero */}
      <FadeUp>
        <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-7 text-white shadow-xl md:p-9">
          <ArcWatermark
            size={460}
            variant="red"
            className="absolute -right-20 -bottom-20 opacity-[0.10]"
          />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                  {data.profile.role.toUpperCase()} wallet
                </p>
                <LiveIndicator
                  variant="dark"
                  lastUpdated={query.lastUpdated}
                  refreshing={query.refreshing}
                  onRefresh={query.refresh}
                />
              </div>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                {data.profile.fullName}
              </h1>
              <p className="mt-1 text-sm text-white/75">
                {data.profile.email ?? "no email"} ·{" "}
                {data.profile.phone ?? "no phone"}
              </p>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-wider text-white/55">
                Current balance
              </p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight md:text-5xl">
                {formatJMD(data.balanceJmd)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdjust((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full bg-rajlo-red px-5 py-2.5 text-sm font-bold text-white shadow-md hover:-translate-y-0.5 hover:bg-primary-hover"
            >
              <Icon name="wallet" className="h-4 w-4" />
              Adjust balance
            </button>
          </div>
        </div>
      </FadeUp>

      {showAdjust && (
        <FadeUp delay={0.04}>
          <AdjustComposer
            userId={userId}
            currentBalance={data.balanceJmd}
            onClose={() => setShowAdjust(false)}
            onSubmitted={() => {
              setShowAdjust(false);
              query.refresh();
            }}
          />
        </FadeUp>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Transactions">
          {data.transactions.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">No transactions yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.transactions.slice(0, 30).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-soft px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold">{t.kind.replace(/_/g, " ")}</p>
                    <p className="truncate text-[10px] text-muted">
                      {t.description ?? ago(t.created_at)}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 font-extrabold ${t.direction === "credit" ? "text-emerald-700" : "text-rajlo-red"}`}
                  >
                    {t.direction === "credit" ? "+" : "−"}
                    {formatJMD(t.amount_jmd)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Withdrawals">
          {data.withdrawals.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">None yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.withdrawals.map((w) => (
                <li
                  key={w.id}
                  className="rounded-xl border border-line bg-surface-soft px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-bold">
                      {formatJMD(w.amount_jmd)} · {w.bank_name ?? "Bank"}
                    </p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase text-muted">
                      {w.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted">
                    {w.account_holder_name ?? ""} · {ago(w.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Deposits">
          {data.deposits.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">None yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.deposits.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-soft px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {formatJMD(d.amount_jmd)} · {d.gateway}
                    </p>
                    <p className="truncate text-[10px] text-muted">
                      {ago(d.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase text-muted">
                    {d.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Transfers">
          {data.transfersSent.length === 0 &&
          data.transfersReceived.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">None yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.transfersSent.map((t) => (
                <li
                  key={`s-${t.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-soft px-3 py-2 text-xs"
                >
                  <p className="truncate font-bold">Sent · {ago(t.created_at)}</p>
                  <p className="text-rajlo-red">−{formatJMD(t.amount_jmd)}</p>
                </li>
              ))}
              {data.transfersReceived.map((t) => (
                <li
                  key={`r-${t.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-soft px-3 py-2 text-xs"
                >
                  <p className="truncate font-bold">
                    Received · {ago(t.created_at)}
                  </p>
                  <p className="text-emerald-700">+{formatJMD(t.amount_jmd)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="font-secondary mb-3 text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
        {title}
      </p>
      {children}
    </div>
  );
}

function AdjustComposer({
  userId,
  currentBalance,
  onClose,
  onSubmitted,
}: {
  userId: string;
  currentBalance: number;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const amountJmd = parseInt(amount, 10);
    if (!Number.isInteger(amountJmd) || amountJmd <= 0) {
      setError("Enter a positive whole number.");
      return;
    }
    if (!reason.trim()) {
      setError("Reason is required.");
      return;
    }
    if (direction === "debit" && amountJmd > currentBalance) {
      setError(`Can't debit more than current balance (${formatJMD(currentBalance)}).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/wallets/${userId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, amountJmd, reason }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Adjustment failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-rajlo-red/30 bg-primary-soft/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
            Manual adjustment
          </p>
          <p className="mt-1 text-sm font-extrabold">
            Logged in admin_audit_logs
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-white"
        >
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs font-bold">Direction</p>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {(["credit", "debit"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold uppercase ${
                  direction === d
                    ? d === "credit"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-rajlo-red/30 bg-primary-soft text-rajlo-red"
                    : "border-line bg-surface text-muted hover:text-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <p className="text-xs font-bold">Amount (JMD)</p>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base font-extrabold focus:border-rajlo-red focus:outline-none"
          />
        </label>
        <label className="block sm:col-span-1">
          <p className="text-xs font-bold">Reason</p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Refund for cancelled trip"
            className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm focus:border-rajlo-red focus:outline-none"
          />
        </label>
      </div>
      {error && (
        <p className="mt-2 text-xs font-semibold text-rajlo-red">{error}</p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-rajlo-red px-5 py-2 text-sm font-bold text-white shadow-md hover:-translate-y-0.5 hover:bg-primary-hover disabled:opacity-50"
      >
        {busy
          ? "Saving…"
          : direction === "credit"
            ? "Credit wallet"
            : "Debit wallet"}
      </button>
    </div>
  );
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
