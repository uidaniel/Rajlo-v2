"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp } from "@/components/anim";
import { Skeleton } from "@/components/skeleton";
import { formatJMD } from "@/lib/jamaica";

/**
 * /rider/wallet/transactions/[id]
 *
 * Receipt-style detail for a single wallet transaction. Hydrates
 * related entities (the ride, route hail, QR charge, deposit, etc.)
 * server-side so the page only does one fetch.
 *
 * Same shape works for the driver wallet — the API is user-scoped, so
 * we could later mount the same page at /driver/wallet/transactions/
 * with a copy of this file. For now the rider's own page is enough.
 */

type Txn = {
  id: string;
  direction: "credit" | "debit";
  amountJmd: number;
  kind: string;
  description: string | null;
  balanceAfterJmd: number;
  createdAt: string;
};

type Related = {
  ride: null | {
    id: string;
    pickupName: string | null;
    dropoffName: string | null;
    distanceKm: number | null;
    completedAt: string | null;
  };
  routeHail: null | {
    id: string;
    pickupName: string | null;
    dropoffName: string | null;
    distanceKm: number | null;
    completedAt: string | null;
    routeOrigin: string | null;
    routeDestination: string | null;
  };
  qrCharge: null | {
    id: string;
    code: string;
    description: string | null;
    confirmedAt: string | null;
  };
  deposit: null | {
    id: string;
    gateway: string;
    gatewayReference: string | null;
    status: string;
    completedAt: string | null;
  };
  withdrawal: null | {
    id: string;
    bankName: string | null;
    bankAccountNumber: string | null;
    status: string;
    paidAt: string | null;
  };
  counterparty: null | { name: string | null };
};

const KIND_META: Record<
  string,
  { label: string; icon: IconName; tone: "credit" | "debit" | "neutral" }
> = {
  deposit: { label: "Wallet top-up", icon: "wallet", tone: "credit" },
  ride_charge: { label: "Trip fare", icon: "car", tone: "debit" },
  ride_earning: {
    label: "Trip earnings",
    icon: "trending-up",
    tone: "credit",
  },
  withdrawal: { label: "Bank withdrawal", icon: "wallet", tone: "debit" },
  withdrawal_refund: {
    label: "Withdrawal refunded",
    icon: "wallet",
    tone: "credit",
  },
  transfer_out: { label: "Sent to user", icon: "arrow-right", tone: "debit" },
  transfer_in: { label: "Received from user", icon: "user", tone: "credit" },
  admin_credit: {
    label: "Adjustment from Rajlo",
    icon: "shield",
    tone: "credit",
  },
  admin_debit: {
    label: "Adjustment from Rajlo",
    icon: "shield",
    tone: "debit",
  },
  refund: { label: "Refund", icon: "wallet", tone: "credit" },
};

export default function WalletTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<{ transaction: Txn; related: Related } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wallet/transactions/${id}`);
        if (res.status === 404) {
          if (!cancelled) setError("Transaction not found.");
          return;
        }
        if (!res.ok) throw new Error("Couldn't load transaction");
        const json = (await res.json()) as {
          transaction: Txn;
          related: Related;
        };
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Couldn't load transaction");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-5 pb-12">
        <Skeleton className="h-44 w-full" rounded="3xl" />
        <Skeleton className="h-32 w-full" rounded="3xl" />
        <Skeleton className="h-28 w-full" rounded="3xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-3xl border border-rajlo-red/30 bg-primary-soft p-7 text-center md:p-10">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rajlo-red text-white shadow-md shadow-rajlo-red/25">
          <Icon name="alert-triangle" className="h-6 w-6" />
        </span>
        <p className="mt-4 text-base font-extrabold tracking-tight">
          We couldn&apos;t load this transaction
        </p>
        <p className="mt-1 text-xs text-rajlo-black/70">
          {error ?? "Try again from your wallet."}
        </p>
        <Link
          href="/rider/wallet"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-rajlo-red px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-rajlo-red/25 hover:-translate-y-0.5 hover:bg-primary-hover"
        >
          <Icon name="chevron-left" className="h-4 w-4" />
          Back to wallet
        </Link>
      </section>
    );
  }

  const { transaction: txn, related } = data;
  const meta = KIND_META[txn.kind] ?? {
    label: "Wallet activity",
    icon: "wallet" as IconName,
    tone: "neutral" as const,
  };
  const isCredit = txn.direction === "credit";
  const sign = isCredit ? "+" : "−";
  const heroBg = isCredit
    ? "bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900"
    : "bg-gradient-to-br from-rajlo-black via-rajlo-black to-[#1a1d10]";

  return (
    <div className="space-y-5 pb-12">
      <Link
        href="/rider/wallet"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-rajlo-red"
      >
        <Icon name="chevron-left" className="h-3.5 w-3.5" />
        Back to wallet
      </Link>

      <FadeUp>
        <section
          className={`relative overflow-hidden rounded-3xl p-7 text-white shadow-xl shadow-rajlo-black/30 md:p-10 ${heroBg}`}
        >
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
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white">
                <Icon name={meta.icon} className="h-4 w-4" />
              </span>
              <span className="font-secondary text-xs font-bold uppercase tracking-wider text-white/80">
                {meta.label}
              </span>
            </div>
            <p className="mt-4 text-5xl font-extrabold tracking-tight md:text-6xl">
              {sign}
              {formatJMD(txn.amountJmd)}
            </p>
            <p className="mt-2 text-sm text-white/75">
              {friendlyDate(txn.createdAt)}
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/90">
              Wallet balance now {formatJMD(txn.balanceAfterJmd)}
            </p>
          </div>
        </section>
      </FadeUp>

      {txn.description && (
        <FadeUp delay={0.04}>
          <section className="rounded-3xl border border-line bg-surface p-5">
            <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
              Note
            </p>
            <p className="mt-1 text-sm">{txn.description}</p>
          </section>
        </FadeUp>
      )}

      {/* Ride / hail / QR detail blocks */}
      {related.ride && (
        <RelatedBlock
          eyebrow="Linked to private ride"
          title={`${related.ride.pickupName ?? "Pickup"} → ${related.ride.dropoffName ?? "Dropoff"}`}
          rows={[
            {
              label: "Distance",
              value: related.ride.distanceKm
                ? `${related.ride.distanceKm.toFixed(1)} km`
                : "—",
            },
            {
              label: "Completed",
              value: related.ride.completedAt
                ? friendlyDate(related.ride.completedAt)
                : "—",
            },
          ]}
          href={`/rider/history/${related.ride.id}`}
        />
      )}

      {related.routeHail && (
        <RelatedBlock
          eyebrow="Linked to route taxi"
          title={
            related.routeHail.routeOrigin && related.routeHail.routeDestination
              ? `${related.routeHail.routeOrigin} → ${related.routeHail.routeDestination}`
              : `${related.routeHail.pickupName ?? "Pickup"} → ${related.routeHail.dropoffName ?? "Dropoff"}`
          }
          rows={[
            {
              label: "Distance",
              value: related.routeHail.distanceKm
                ? `${related.routeHail.distanceKm.toFixed(1)} km`
                : "—",
            },
            {
              label: "Completed",
              value: related.routeHail.completedAt
                ? friendlyDate(related.routeHail.completedAt)
                : "—",
            },
          ]}
          href={`/rider/route-taxi/history/${related.routeHail.id}`}
        />
      )}

      {related.qrCharge && (
        <RelatedBlock
          eyebrow="Linked to QR pay"
          title={related.qrCharge.description ?? "QR charge"}
          rows={[
            { label: "Code", value: related.qrCharge.code },
            {
              label: "Confirmed",
              value: related.qrCharge.confirmedAt
                ? friendlyDate(related.qrCharge.confirmedAt)
                : "—",
            },
          ]}
        />
      )}

      {related.deposit && (
        <RelatedBlock
          eyebrow="Top-up details"
          title={`Via ${related.deposit.gateway.toUpperCase()}`}
          rows={[
            { label: "Status", value: related.deposit.status },
            {
              label: "Reference",
              value: related.deposit.gatewayReference ?? "—",
            },
            {
              label: "Settled",
              value: related.deposit.completedAt
                ? friendlyDate(related.deposit.completedAt)
                : "—",
            },
          ]}
        />
      )}

      {related.withdrawal && (
        <RelatedBlock
          eyebrow="Withdrawal details"
          title={related.withdrawal.bankName ?? "Bank transfer"}
          rows={[
            { label: "Account", value: related.withdrawal.bankAccountNumber ?? "—" },
            { label: "Status", value: related.withdrawal.status },
            {
              label: "Paid",
              value: related.withdrawal.paidAt
                ? friendlyDate(related.withdrawal.paidAt)
                : "—",
            },
          ]}
        />
      )}

      {related.counterparty?.name && !related.ride && !related.routeHail && (
        <RelatedBlock
          eyebrow={isCredit ? "From" : "To"}
          title={related.counterparty.name}
          rows={[]}
        />
      )}

      {/* Transaction id at the bottom for support */}
      <FadeUp delay={0.2}>
        <section className="rounded-2xl border border-dashed border-line bg-surface-soft p-4 text-center">
          <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
            Transaction ID (for support)
          </p>
          <p className="mt-1 select-all break-all font-mono text-[11px] text-foreground">
            {txn.id}
          </p>
        </section>
      </FadeUp>
    </div>
  );
}

function RelatedBlock({
  eyebrow,
  title,
  rows,
  href,
}: {
  eyebrow: string;
  title: string;
  rows: { label: string; value: string }[];
  href?: string;
}) {
  const inner = (
    <>
      <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
        {eyebrow}
      </p>
      <p className="mt-1 truncate text-sm font-extrabold tracking-tight md:text-base">
        {title}
      </p>
      {rows.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {rows.map((r) => (
            <div key={r.label} className="rounded-lg bg-surface-soft px-3 py-2">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {r.label}
              </dt>
              <dd className="mt-0.5 truncate text-sm font-bold">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );

  return (
    <FadeUp delay={0.06}>
      {href ? (
        <Link
          href={href}
          className="block rounded-3xl border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-rajlo-red/30 hover:shadow-md"
        >
          {inner}
          <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-rajlo-red">
            View full receipt
            <Icon name="arrow-right" className="h-3 w-3" />
          </p>
        </Link>
      ) : (
        <section className="rounded-3xl border border-line bg-surface p-5">
          {inner}
        </section>
      )}
    </FadeUp>
  );
}

function friendlyDate(iso: string): string {
  return new Date(iso).toLocaleString("en-JM", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
