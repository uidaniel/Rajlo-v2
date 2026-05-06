"use client";

import React from "react";
import Link from "next/link";
import { RideRequestCard } from "@/components/ride-request-card";
import { complianceThresholds } from "@/lib/mock-data";
import { buildMockCompliancePayload } from "@/lib/compliance-utils";

export default function DriverHomePage() {
  const [acceptedRequest, setAcceptedRequest] = React.useState<string | null>(null);
  const [complianceSummary, setComplianceSummary] = React.useState(() => buildMockCompliancePayload("DRV-1031").summary);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function loadComplianceSummary() {
      try {
        const response = await fetch("/api/driver/compliance?driverId=DRV-1031");
        if (!response.ok) {
          throw new Error("Failed to load compliance summary");
        }
        const payload = (await response.json()) as { summary: { expired: number; urgent: number; upcoming: number } };
        if (mounted && payload.summary) {
          setComplianceSummary(payload.summary);
          setLoadError(null);
        }
      } catch {
        if (mounted) {
          setLoadError("Using fallback compliance summary");
        }
      }
    }

    loadComplianceSummary();

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

  if (acceptedRequest) {
    const request = incomingRequests.find((r) => r.id === acceptedRequest);
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-line bg-emerald-50 p-6 text-center">
          <svg
            className="h-12 w-12 text-emerald-600 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-emerald-900 mt-2">Ride Accepted!</h2>
          <p className="text-sm text-emerald-700 mt-1">Head to the pickup location</p>
        </div>

        {request && (
          <RideRequestCard
            ride={{
              ...request,
              status: "accepted",
            }}
          />
        )}

        <Link
          href="/driver/active-trip"
          className="block rounded-lg bg-primary py-3 font-semibold text-white hover:opacity-90 transition-opacity text-center"
        >
          View Active Trip
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border px-4 py-2 text-xs" style={{ borderColor: "#b45309", color: "#92660c", background: "#fef7e0" }}>
          {loadError}
        </div>
      )}

      {/* Compliance Banner */}
      {(complianceSummary.expired > 0 || complianceSummary.urgent > 0 || complianceSummary.upcoming > 0) && (
        <div
          className="rounded-2xl border p-4 md:p-5"
          style={{
            background:
              complianceSummary.expired > 0
                ? "#fdecea"
                : complianceSummary.urgent > 0
                  ? "#fef7e0"
                  : "var(--primary-soft)",
            borderColor:
              complianceSummary.expired > 0
                ? "#c0392b"
                : complianceSummary.urgent > 0
                  ? "#b45309"
                  : "var(--primary)",
          }}
        >
          <p
            className="text-sm font-semibold"
            style={{
              color:
                complianceSummary.expired > 0
                  ? "#c0392b"
                  : complianceSummary.urgent > 0
                    ? "#b45309"
                    : "var(--primary)",
            }}
          >
            {complianceSummary.expired > 0
              ? `${complianceSummary.expired} TA document(s) expired or missing. Your account may be suspended.`
              : complianceSummary.urgent > 0
                ? `${complianceSummary.urgent} TA document(s) expire within ${complianceThresholds.urgentDays} days.`
                : `${complianceSummary.upcoming} TA document(s) due within ${complianceThresholds.warningDays} days.`}
          </p>
          <p
            className="text-xs mt-1"
            style={{
              color:
                complianceSummary.expired > 0
                  ? "#c0392b"
                  : complianceSummary.urgent > 0
                    ? "#92660c"
                    : "var(--primary)",
            }}
          >
            Keep all TA documents current to continue receiving ride requests.
          </p>
          <Link
            href="/driver/verification"
            className="inline-block mt-3 rounded-full px-4 py-1.5 text-xs font-semibold text-white"
            style={{ background: "var(--primary)" }}
          >
            View Compliance Status
          </Link>
        </div>
      )}

      {/* Status Toggle */}
      <div className="rounded-2xl border border-line bg-surface p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Your Status</p>
            <p className="text-xl font-semibold">Online & Ready</p>
          </div>
          <button className="relative inline-flex h-8 w-14 items-center rounded-full bg-emerald-500">
            <div className="inline-flex h-6 w-6 transform rounded-full bg-white ml-1 transition-all" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Requests", value: incomingRequests.length.toString() },
          { label: "Today Earnings", value: "JMD 5.2K" },
          { label: "Rating", value: "4.8" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-line bg-surface p-4 text-center"
          >
            <p className="text-xs text-muted mb-1">{stat.label}</p>
            <p className="text-lg md:text-2xl font-bold text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Incoming Requests */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Incoming Requests</h2>
        <div className="space-y-3">
          {incomingRequests.map((request) => (
            <RideRequestCard
              key={request.id}
              ride={request}
              onAccept={() => setAcceptedRequest(request.id)}
              onDecline={() => {
                // Handle decline
              }}
            />
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Earnings", href: "/driver/earnings", icon: "💰" },
          { label: "Trip History", href: "/driver/history", icon: "📋" },
          { label: "Compliance", href: "/driver/verification", icon: "✅" },
          { label: "Renewals", href: "/driver/notifications", icon: "⏰" },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-xl border border-line bg-surface p-4 text-center hover:bg-surface-soft transition-colors"
          >
            <div className="text-2xl mb-2">{action.icon}</div>
            <p className="text-xs font-medium">{action.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}