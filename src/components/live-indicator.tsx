"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

/**
 * Small pill that signals "this view is live and was last refreshed
 * X seconds ago." Goes in the top-right of every admin page so the
 * admin can see at a glance that data is current — and click to force
 * a refresh if they want it sooner than the next polling tick.
 *
 * Variants:
 *   "default" — light surface with subtle border, sits inside cards
 *   "dark"    — used on the rajlo-black hero banners
 */

type Variant = "default" | "dark";

export function LiveIndicator({
  lastUpdated,
  refreshing,
  onRefresh,
  variant = "default",
}: {
  lastUpdated: Date | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  variant?: Variant;
}) {
  // Re-render every second so the "Xs ago" label stays accurate even
  // when the underlying lastUpdated hasn't moved. A 1Hz tick is cheap
  // (one setState per second per pill) and keeps the UX honest.
  const [now, setNow] = useState(() =>
    typeof window === "undefined" ? 0 : Date.now(),
  );
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = lastUpdated
    ? Math.max(0, Math.floor((now - lastUpdated.getTime()) / 1000))
    : null;

  const label =
    elapsedSec === null
      ? "Connecting…"
      : refreshing
        ? "Refreshing…"
        : elapsedSec < 5
          ? "Just now"
          : elapsedSec < 60
            ? `${elapsedSec}s ago`
            : elapsedSec < 3600
              ? `${Math.floor(elapsedSec / 60)}m ago`
              : `${Math.floor(elapsedSec / 3600)}h ago`;

  // Dot tone reflects freshness — green when very recent, amber while
  // refreshing or aging into a stale window, dim when stale.
  const dotTone = refreshing
    ? "bg-amber-400"
    : elapsedSec === null
      ? "bg-muted"
      : elapsedSec < 30
        ? "bg-emerald-500"
        : elapsedSec < 120
          ? "bg-amber-400"
          : "bg-muted";

  const containerClass =
    variant === "dark"
      ? "border-white/20 bg-white/10 text-white/85 backdrop-blur hover:bg-white/20"
      : "border-line bg-surface text-muted hover:border-rajlo-red/40 hover:text-foreground";

  const inner = (
    <>
      <span className="relative grid h-2 w-2 place-items-center">
        <span
          className={`absolute inset-0 rounded-full ${dotTone} opacity-50 ${refreshing ? "animate-ping" : ""}`}
        />
        <span className={`h-2 w-2 rounded-full ${dotTone}`} />
      </span>
      <span className="uppercase tracking-wider">Live</span>
      <span className="opacity-70">·</span>
      <span>{label}</span>
      {onRefresh && (
        <Icon
          name={refreshing ? "clock" : "arrow-right"}
          className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
        />
      )}
    </>
  );

  const className = `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all ${containerClass}`;

  if (onRefresh) {
    return (
      <button
        type="button"
        onClick={onRefresh}
        title="Click to refresh now"
        className={`${className} cursor-pointer`}
      >
        {inner}
      </button>
    );
  }
  return (
    <span
      title={
        lastUpdated
          ? `Last updated ${lastUpdated.toLocaleTimeString("en-JM")}`
          : undefined
      }
      className={className}
    >
      {inner}
    </span>
  );
}
