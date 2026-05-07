/**
 * Decorative brand watermark — the arc+circle motif derived from the logo "O".
 * Per the brand guidelines (Sept 2024), this appears as a low-opacity element
 * in the bottom-right of most surfaces. Pure SVG, position with absolute
 * positioning from the parent.
 */
export function ArcWatermark({
  size = 480,
  className = "",
  variant = "muted",
}: {
  size?: number;
  className?: string;
  variant?: "muted" | "red" | "white";
}) {
  const colorClass =
    variant === "red"
      ? "text-rajlo-red"
      : variant === "white"
        ? "text-white"
        : "text-rajlo-black";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth="14"
      aria-hidden="true"
      className={`pointer-events-none select-none opacity-[0.07] ${colorClass} ${className}`}
    >
      {/* Outer arc (largest) */}
      <path d="M 18 110 A 82 82 0 0 1 182 110" />
      {/* Middle ring */}
      <circle cx="100" cy="130" r="58" />
      {/* Inner ring */}
      <circle cx="100" cy="130" r="34" />
    </svg>
  );
}

/**
 * Tile-able pattern of arc+ring units. Use as a textured background for
 * full-bleed sections (hero panels, side rails). Renders multiple watermark
 * units in a grid.
 */
export function ArcPatternTile({
  className = "",
  variant = "muted",
}: {
  className?: string;
  variant?: "muted" | "red" | "white";
}) {
  const colorClass =
    variant === "red"
      ? "text-rajlo-red"
      : variant === "white"
        ? "text-white"
        : "text-rajlo-black";

  return (
    <svg
      width="160"
      height="160"
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      aria-hidden="true"
      className={`${colorClass} ${className}`}
    >
      <path d="M 14 38 A 36 36 0 0 1 86 38" />
      <circle cx="50" cy="62" r="22" />
    </svg>
  );
}
