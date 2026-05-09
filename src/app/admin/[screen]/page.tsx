import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";

/**
 * Catch-all for back-office pages that don't have backing tables yet.
 * Anything still routed through here is on the roadmap — no more
 * mock-data placeholders pretending to be real pages.
 *
 * Pages that DO have real backing tables and real Supabase data live
 * at their own routes (operations, analytics, ride-monitoring, users,
 * verification-queue, vehicle-changes, audit-logs).
 */

const ROADMAP: Record<
  string,
  { title: string; description: string; live: string; liveLabel: string }
> = {
  parishes: {
    title: "Parish admin",
    description:
      "Add, edit, or retire parish entries; tag them with multipliers used by the fare engine.",
    live: "/admin/analytics",
    liveLabel: "See parish ride volume in analytics",
  },
  "fare-rules": {
    title: "Fare rules",
    description:
      "Per-parish-pair base fares + per-km / per-minute rates. Currently configured directly in the fare-engine code.",
    live: "/admin/ride-monitoring",
    liveLabel: "See live ride pricing",
  },
  "fare-overrides": {
    title: "Fare overrides",
    description:
      "Time-bound surge or discount overrides for specific parish pairs. Coming once we have the bookings data to back surge decisions.",
    live: "/admin/analytics",
    liveLabel: "Open analytics",
  },
  disputes: {
    title: "Disputes",
    description:
      "Dispute case management for refund claims and rider-driver complaints.",
    live: "/admin/audit-logs",
    liveLabel: "Browse audit logs",
  },
  payouts: {
    title: "Driver payouts",
    description:
      "Direct deposit settlement, banking ledger, and instant cash-out controls. Lands once the payment processor integration is live.",
    live: "/admin/users?role=driver",
    liveLabel: "Open driver list",
  },
  "notification-templates": {
    title: "Notification templates",
    description:
      "Edit subject lines + bodies for the email and push notifications the system sends.",
    live: "/admin/audit-logs",
    liveLabel: "See sent-notification audit trail",
  },
  "risk-alerts": {
    title: "Risk alerts",
    description:
      "Automated rule-based flagging — e.g. driver completing 50+ rides/day, rider with three 1★ ratings in a week.",
    live: "/admin/audit-logs?source=admin",
    liveLabel: "Browse audit signals",
  },
};

export default async function AdminRoadmapPage({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  const cfg = ROADMAP[screen];
  if (!cfg) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-2 py-6 md:px-3 md:py-10">
      <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-7 text-white shadow-xl md:p-10">
        <ArcWatermark
          size={420}
          variant="red"
          className="absolute -right-20 -bottom-20 opacity-[0.10]"
        />
        <div className="relative">
          <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
            Roadmap
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            {cfg.title}
          </h1>
          <p className="mt-2 max-w-md text-sm text-white/75">
            {cfg.description}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-line bg-surface-soft p-5 text-sm">
        <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
          Why isn&apos;t this live yet?
        </p>
        <p className="mt-2 leading-relaxed">
          We deliberately removed mock-data placeholders from the admin
          panel so every screen reflects real Supabase state. This area
          gets built out alongside the supporting schema migrations — when
          the database tables exist, the page goes live.
        </p>
      </div>

      <Link
        href={cfg.live}
        className="group flex items-center justify-between rounded-2xl border border-dashed border-line bg-surface-soft px-5 py-4 transition-colors hover:border-rajlo-red hover:bg-primary-soft/40"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-rajlo-red shadow-sm">
            <Icon name="arrow-right" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold">{cfg.liveLabel}</p>
            <p className="mt-0.5 text-xs text-muted">
              The closest live surface for the data behind this page.
            </p>
          </div>
        </div>
        <Icon
          name="chevron-right"
          className="h-5 w-5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-rajlo-red"
        />
      </Link>
    </div>
  );
}
