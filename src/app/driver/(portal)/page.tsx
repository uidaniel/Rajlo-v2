"use client";

import React from "react";
import Link from "next/link";
import { RideRequestCard } from "@/components/ride-request-card";
import { complianceThresholds } from "@/lib/mock-data";
import { buildMockCompliancePayload } from "@/lib/compliance-utils";
import { Icon, type IconName } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp, Stagger, StaggerItem } from "@/components/anim";

export default function DriverHomePage() {
  const [acceptedRequest, setAcceptedRequest] = React.useState<string | null>(null);
  const [complianceSummary, setComplianceSummary] = React.useState(
    () => buildMockCompliancePayload("DRV-1031").summary,
  );
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch("/api/driver/compliance?driverId=DRV-1031");
        if (!response.ok) return;
        const payload = (await response.json()) as {
          summary: { expired: number; urgent: number; upcoming: number };
        };
        if (mounted && payload.summary) setComplianceSummary(payload.summary);
      } catch {
        /* silent — fall back to mock */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const incomingRequests = [
    {
      id: "req-001",
      from: "Cross Roads",
      to: "Half-Way Tree",
      eta: "3 mins away",
      price: "JMD 580",
      seats: 2,
      status: "searching" as const,
    },
    {
      id: "req-002",
      from: "New Kingston",
      to: "Papine",
      eta: "5 mins away",
      price: "JMD 420",
      seats: 1,
      status: "searching" as const,
    },
  ];

  /* ───────────── Accepted view ───────────── */
  if (acceptedRequest) {
    const request = incomingRequests.find((r) => r.id === acceptedRequest);
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <FadeUp>
          <div className="relative overflow-hidden rounded-3xl bg-rajlo-red p-6 text-white shadow-xl shadow-rajlo-red/25 md:p-8">
            <ArcWatermark size={300} variant="white" className="absolute -right-12 -bottom-12 opacity-[0.10]" />
            <div className="relative flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-rajlo-red shadow-lg">
                <Icon name="check-circle" className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">Ride accepted!</h2>
                <p className="mt-1 text-sm text-white/85 md:text-base">
                  Head to the pickup location.
                </p>
              </div>
            </div>
          </div>
        </FadeUp>

        {request && (
          <FadeUp delay={0.1}>
            <RideRequestCard ride={{ ...request, status: "accepted" }} />
          </FadeUp>
        )}

        <FadeUp delay={0.2}>
          <Link
            href="/driver/active-trip"
            className="group flex items-center justify-center gap-2 rounded-full bg-rajlo-black px-6 py-3.5 text-center text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-black"
          >
            View active trip
            <Icon name="arrow-right" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </FadeUp>
      </div>
    );
  }

  /* ───────────── Default view ───────────── */
  const complianceTone =
    complianceSummary.expired > 0
      ? "danger"
      : complianceSummary.urgent > 0
        ? "warn"
        : complianceSummary.upcoming > 0
          ? "info"
          : null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 md:px-6 md:py-8">
      {/* ─────── Welcome / status hero ─────── */}
      <FadeUp>
        <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-6 text-white shadow-xl md:p-8">
          <ArcWatermark size={420} variant="red" className="absolute -right-20 -bottom-32 opacity-[0.12]" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                Driver dashboard
              </p>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                {online ? "You're online & ready." : "You're offline."}
              </h1>
              <p className="mt-1 text-sm text-white/70 md:text-base">
                {online
                  ? "Incoming ride requests will appear below."
                  : "Toggle online to start receiving requests."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOnline((o) => !o)}
              aria-pressed={online}
              aria-label={online ? "Go offline" : "Go online"}
              className={`relative inline-flex h-11 w-20 items-center rounded-full transition-colors ${
                online ? "bg-emerald-500" : "bg-white/15"
              }`}
            >
              <span
                className={`inline-flex h-9 w-9 transform items-center justify-center rounded-full bg-white shadow-lg transition-all ${
                  online ? "translate-x-10" : "translate-x-1"
                }`}
              >
                <Icon
                  name={online ? "check-circle" : "x"}
                  className={`h-4 w-4 ${online ? "text-emerald-600" : "text-muted"}`}
                />
              </span>
            </button>
          </div>
        </div>
      </FadeUp>

      {/* ─────── Compliance banner ─────── */}
      {complianceTone && (
        <FadeUp delay={0.05}>
          <div
            className={`flex flex-col gap-3 rounded-2xl border p-5 md:flex-row md:items-center md:justify-between ${
              complianceTone === "danger"
                ? "border-rajlo-red/30 bg-primary-soft"
                : complianceTone === "warn"
                  ? "border-amber-200 bg-amber-50"
                  : "border-rajlo-red/20 bg-primary-soft/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                  complianceTone === "danger"
                    ? "bg-rajlo-red text-white"
                    : complianceTone === "warn"
                      ? "bg-amber-500 text-white"
                      : "bg-rajlo-red/15 text-rajlo-red"
                }`}
              >
                <Icon
                  name={complianceTone === "danger" ? "alert-triangle" : "shield-alert"}
                  className="h-5 w-5"
                />
              </span>
              <div>
                <p className="text-sm font-bold leading-snug">
                  {complianceSummary.expired > 0
                    ? `${complianceSummary.expired} TA document${complianceSummary.expired > 1 ? "s" : ""} expired or missing.`
                    : complianceSummary.urgent > 0
                      ? `${complianceSummary.urgent} TA document${complianceSummary.urgent > 1 ? "s" : ""} expire within ${complianceThresholds.urgentDays} days.`
                      : `${complianceSummary.upcoming} TA document${complianceSummary.upcoming > 1 ? "s" : ""} due within ${complianceThresholds.warningDays} days.`}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Keep TA documents current to continue accepting ride requests.
                </p>
              </div>
            </div>
            <Link
              href="/driver/verification"
              className="shrink-0 self-start rounded-full bg-rajlo-red px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover md:self-center"
            >
              View compliance →
            </Link>
          </div>
        </FadeUp>
      )}

      {/* ─────── Stats ─────── */}
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Requests" value={incomingRequests.length.toString()} icon="inbox" />
        <Stat label="Today" value="JMD 5.2k" icon="trending-up" />
        <Stat label="Rating" value="4.8" icon="star" />
        <Stat label="Trips" value="142" icon="navigation" />
      </Stagger>

      {/* ─────── Incoming requests ─────── */}
      {online && incomingRequests.length > 0 && (
        <FadeUp delay={0.1}>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight md:text-xl">
                Incoming requests
              </h2>
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-rajlo-red">
                {incomingRequests.length} new
              </span>
            </div>
            <div className="space-y-3">
              {incomingRequests.map((request) => (
                <RideRequestCard
                  key={request.id}
                  ride={request}
                  onAccept={() => setAcceptedRequest(request.id)}
                  onDecline={() => {
                    /* mock */
                  }}
                />
              ))}
            </div>
          </div>
        </FadeUp>
      )}

      {/* ─────── Quick actions ─────── */}
      <FadeUp delay={0.15}>
        <div>
          <h2 className="mb-3 text-lg font-extrabold tracking-tight md:text-xl">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ActionCard label="Earnings" href="/driver/earnings" icon="trending-up" />
            <ActionCard label="History" href="/driver/history" icon="clock" />
            <ActionCard label="Compliance" href="/driver/verification" icon="shield-check" />
            <ActionCard label="Notifications" href="/driver/notifications" icon="bell" />
          </div>
        </div>
      </FadeUp>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <StaggerItem>
      <div className="rounded-2xl border border-line bg-surface p-4 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-soft text-rajlo-red">
            <Icon name={icon} className="h-3.5 w-3.5" />
          </span>
        </div>
        <p className="mt-2 text-2xl font-extrabold tracking-tight text-rajlo-red md:text-3xl">
          {value}
        </p>
      </div>
    </StaggerItem>
  );
}

function ActionCard({
  label,
  href,
  icon,
}: {
  label: string;
  href: string;
  icon: IconName;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-rajlo-red hover:shadow-md"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-rajlo-red transition-colors group-hover:bg-rajlo-red group-hover:text-white">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="text-sm font-bold">{label}</p>
    </Link>
  );
}
