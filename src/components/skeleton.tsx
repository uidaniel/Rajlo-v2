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
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-line bg-surface-soft ${className}`}
      aria-hidden
    >
      <div className="absolute inset-0 shimmer" />
      {/* Faint route hint so it reads as "a map is loading", not "an empty box". */}
      <svg
        className="absolute inset-0 h-full w-full opacity-30"
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
      >
        <path
          d="M 8 50 Q 30 32 40 36 T 70 22 T 92 14"
          fill="none"
          stroke="#f10100"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="3 3"
        />
        <circle cx="8" cy="50" r="2.4" fill="#10b981" />
        <circle cx="92" cy="14" r="2.4" fill="#f10100" />
      </svg>
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
