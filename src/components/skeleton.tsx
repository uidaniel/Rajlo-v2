/**
 * Shimmer-loading primitives + content-shape skeletons.
 *
 * `<Skeleton />` is the atomic block — a div with the shimmer
 * animation and configurable shape via Tailwind utilities passed in
 * `className`. Everything else in this file is a composition of those
 * blocks shaped to match the real UI it replaces while loading.
 *
 * Goal: when a page first renders, the skeleton fills the same boxes
 * the real content will occupy, so there's no layout shift the moment
 * the fetch resolves. This is what makes the wait feel instant.
 */

export function Skeleton({
  className = "",
  variant = "light",
  rounded = "md",
}: {
  className?: string;
  /** "dark" inverts to a translucent-white shimmer for use on dark
   *  surfaces (hero banners, the rajlo-black dashboard hero). */
  variant?: "light" | "dark";
  /** Tailwind rounded shorthand. Defaults to `md`; pass `full` for
   *  pills/avatars, `xl`/`2xl` for cards. */
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
}) {
  const roundedClass =
    rounded === "none"
      ? ""
      : rounded === "full"
        ? "rounded-full"
        : `rounded-${rounded}`;
  return (
    <div
      aria-hidden
      className={`${variant === "dark" ? "shimmer-dark" : "shimmer"} ${roundedClass} ${className}`}
    />
  );
}

/* ──────────────── Composed: hero block ──────────────── */

/**
 * Tall dark hero placeholder — matches the rajlo-black dashboard
 * hero, the trip-share hero, and the ratings/earnings hero shapes.
 */
export function HeroSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-7 md:p-10">
      <div className="space-y-3">
        <Skeleton variant="dark" className="h-3 w-32" rounded="full" />
        <Skeleton variant="dark" className="h-9 w-3/4 max-w-md" rounded="lg" />
        <Skeleton variant="dark" className="h-9 w-2/3 max-w-sm" rounded="lg" />
        <Skeleton
          variant="dark"
          className="mt-4 h-4 w-full max-w-md"
          rounded="md"
        />
        <Skeleton variant="dark" className="h-4 w-1/2 max-w-xs" rounded="md" />
      </div>
    </div>
  );
}

/* ──────────────── Composed: ride / route card ──────────────── */

/**
 * Approximate the shape of a ride card (history row, recent-trip
 * row, inbox card): status pill at top, two-line A/B route, fare on
 * the right, footer line.
 */
export function RideCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-24" rounded="full" />
          <Skeleton className="h-3 w-32" rounded="md" />
        </div>
        <Skeleton className="h-5 w-16" rounded="md" />
      </div>
      <div className="mt-4 space-y-3">
        <RouteRowSkeleton />
        <RouteRowSkeleton />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <Skeleton className="h-3 w-32" rounded="md" />
        <Skeleton className="h-5 w-20" rounded="full" />
      </div>
    </div>
  );
}

function RouteRowSkeleton() {
  return (
    <div className="flex items-start gap-3">
      <Skeleton className="mt-1 h-7 w-7" rounded="full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4 max-w-56" rounded="md" />
        <Skeleton className="h-2.5 w-1/2 max-w-40" rounded="md" />
      </div>
    </div>
  );
}

/* ──────────────── Composed: simple list row ──────────────── */

/**
 * Compact list row — used for the dashboard's "recent trips" feed
 * and any inline rebook chips. Lighter than RideCardSkeleton.
 */
export function ListRowSkeleton({
  withTrailing = true,
}: {
  withTrailing?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
      <Skeleton className="h-10 w-10" rounded="lg" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3 w-2/3 max-w-72" rounded="md" />
        <Skeleton className="h-2.5 w-1/3 max-w-40" rounded="md" />
      </div>
      {withTrailing && (
        <div className="space-y-1.5 text-right">
          <Skeleton className="ml-auto h-3 w-16" rounded="md" />
          <Skeleton className="ml-auto h-2 w-12" rounded="md" />
        </div>
      )}
    </div>
  );
}

/* ──────────────── Composed: notification card ──────────────── */

export function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
      <Skeleton className="h-10 w-10" rounded="xl" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/3 max-w-64" rounded="md" />
        <Skeleton className="h-3 w-full max-w-80" rounded="md" />
        <Skeleton className="h-2.5 w-1/2 max-w-48" rounded="md" />
      </div>
    </div>
  );
}

/* ──────────────── Composed: map placeholder ──────────────── */

/**
 * Map placeholder used by live-trip + ride detail while Google Maps
 * boots up. Includes a faint route line + two markers so the silhouette
 * matches the loaded map.
 */
export function MapSkeleton({
  className = "h-[55vh] min-h-80 w-full md:h-[60vh] md:max-h-160",
}: {
  className?: string;
}) {
  // Plain shimmer — the route-line illustration that used to live
  // here was distracting because it implied a route was already
  // computed. A flat shimmer block reads correctly as "loading the
  // map," matching every other skeleton in the app.
  return (
    <div
      className={`relative overflow-hidden rounded-3xl ${className}`}
      aria-hidden
    >
      <div className="shimmer h-full w-full" />
    </div>
  );
}

/* ──────────────── Composed: stat grid ──────────────── */

/**
 * Used in the dashboard stats strip + KPI tiles on earnings and
 * history. Renders N stat tiles with a label + value placeholder.
 */
export function StatsGridSkeleton({
  count = 3,
  variant = "light",
}: {
  count?: number;
  variant?: "light" | "dark";
}) {
  const dark = variant === "dark";
  const cols =
    count === 2
      ? "grid-cols-2"
      : count === 4
        ? "grid-cols-2 md:grid-cols-4"
        : "grid-cols-3";
  return (
    <div
      className={`grid ${cols} gap-3 ${dark ? "" : ""}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`rounded-2xl border p-4 ${
            dark
              ? "border-white/10 bg-rajlo-black"
              : "border-line bg-surface"
          }`}
        >
          <Skeleton
            variant={dark ? "dark" : "light"}
            className="h-2.5 w-16"
            rounded="md"
          />
          <Skeleton
            variant={dark ? "dark" : "light"}
            className="mt-3 h-7 w-20"
            rounded="md"
          />
        </div>
      ))}
    </div>
  );
}

/* ──────────────── Composed: settings section ──────────────── */

/**
 * Settings/safety toggle rows — label + description + toggle pill.
 */
export function ToggleRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-32" rounded="md" />
            <Skeleton className="h-2.5 w-48" rounded="md" />
          </div>
          <Skeleton className="h-7 w-12" rounded="full" />
        </div>
      ))}
    </div>
  );
}

/* ──────────────── Composed: driver-vehicle card ──────────────── */

/**
 * Mirrors `DriverVehicleCard`'s shape — avatar, name + rating,
 * vehicle strip with a colour swatch and plate.
 */
export function DriverVehicleCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-rajlo-red/20 bg-primary-soft/40">
      <div className="flex items-start gap-4 p-5">
        <Skeleton className="h-16 w-16" rounded="full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-2.5 w-20" rounded="md" />
          <Skeleton className="h-4 w-3/4 max-w-48" rounded="md" />
          <Skeleton className="h-3 w-24" rounded="full" />
        </div>
        <Skeleton className="h-10 w-10" rounded="full" />
      </div>
      <div className="flex items-center gap-3 border-t border-rajlo-red/15 bg-white px-5 py-3">
        <Skeleton className="h-9 w-9" rounded="xl" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3 w-2/3 max-w-56" rounded="md" />
          <Skeleton className="h-2.5 w-1/2 max-w-40" rounded="md" />
        </div>
      </div>
    </div>
  );
}

/* ──────────────── Composed: tab strip ──────────────── */

export function TabsSkeleton({ tabs = 3 }: { tabs?: number }) {
  return (
    <div className="inline-flex gap-1 rounded-full border border-line bg-surface-soft p-1">
      {Array.from({ length: tabs }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24" rounded="full" />
      ))}
    </div>
  );
}

/* ──────────────── Composed: admin KPI tile ──────────────── */

/**
 * Mirrors the KPI tiles on the operations dashboard + analytics page —
 * eyebrow label, big number, caption row, and a small inline sparkline
 * placeholder so the layout doesn't shift when the real number arrives.
 */
export function KpiTileSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-20" rounded="full" />
          <Skeleton className="h-7 w-28" rounded="lg" />
        </div>
        <Skeleton className="h-10 w-10" rounded="xl" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-32" rounded="md" />
        <Skeleton className="h-8 w-20" rounded="md" />
      </div>
    </div>
  );
}

/**
 * Compact strip of N KPI tiles — one call replaces a whole top-of-page
 * scoreboard. Defaults to 4 tiles to match the operations dashboard.
 */
export function KpiStripSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: tiles }).map((_, i) => (
        <KpiTileSkeleton key={i} />
      ))}
    </div>
  );
}

/* ──────────────── Composed: chart card ──────────────── */

/**
 * Card frame with eyebrow + title + a tall body block, sized to look
 * like an area / bar / donut chart panel. The body block inherits its
 * height so callers can override for taller donuts vs short sparklines.
 */
export function ChartCardSkeleton({
  bodyHeight = "h-44",
}: {
  bodyHeight?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="space-y-2">
        <Skeleton className="h-2.5 w-24" rounded="full" />
        <Skeleton className="h-4 w-40" rounded="md" />
      </div>
      <Skeleton className={`mt-4 w-full ${bodyHeight}`} rounded="xl" />
    </div>
  );
}

/* ──────────────── Composed: table row ──────────────── */

/**
 * Used by every table-style admin list (users, rides, audit logs).
 * Renders one row that mimics avatar / two-line label / metadata /
 * action chips so the table doesn't reflow when the rows arrive.
 */
export function TableRowSkeleton() {
  return (
    <div className="grid grid-cols-1 items-center gap-3 px-3 py-3 md:grid-cols-[2fr,1fr,1fr,auto] md:px-5 md:py-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10" rounded="xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/4 max-w-48" rounded="md" />
          <Skeleton className="h-2.5 w-1/2 max-w-32" rounded="md" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-20" rounded="md" />
        <Skeleton className="h-2.5 w-16" rounded="md" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24" rounded="md" />
        <Skeleton className="h-2.5 w-16" rounded="md" />
      </div>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-7 w-16" rounded="full" />
        <Skeleton className="h-7 w-20" rounded="full" />
      </div>
    </div>
  );
}

/**
 * Convenience wrapper — N rows inside a card frame. Good for the body
 * of any admin list view while the data is in-flight.
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/* ──────────────── Composed: activity feed ──────────────── */

/**
 * Feed-style row: small icon tile, two text lines, trailing timestamp.
 * Matches the live-activity panel + audit-log row shape.
 */
export function ActivityRowSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-xl px-2 py-2">
      <Skeleton className="h-8 w-8" rounded="lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3 w-2/3 max-w-56" rounded="md" />
        <Skeleton className="h-2.5 w-3/4 max-w-72" rounded="md" />
      </div>
      <Skeleton className="h-2.5 w-8" rounded="md" />
    </div>
  );
}

export function ActivityFeedSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i}>
          <ActivityRowSkeleton />
        </li>
      ))}
    </ul>
  );
}

/* ──────────────── Composed: leaderboard / rank list ──────────────── */

/**
 * Numbered ranked list — top drivers, top riders, top parishes.
 */
export function LeaderboardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface-soft px-3 py-2.5"
        >
          <Skeleton className="h-7 w-7" rounded="full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4 max-w-48" rounded="md" />
            <Skeleton className="h-2.5 w-1/2 max-w-32" rounded="md" />
          </div>
          <Skeleton className="h-3 w-16" rounded="md" />
        </li>
      ))}
    </ul>
  );
}
