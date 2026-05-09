import Link from "next/link";

/**
 * Rajlo wordmark — renders the canonical brand SVG paths from
 * `public/Rajlo main logo.svg` (the official asset Raj supplied).
 *
 * Anatomy of the official wordmark:
 *   • "Rajl"   — drawn in the dark/black ink (per `default` variant)
 *   • "o"      — drawn in red (#f10100) as a hollow circle
 *   • Arc      — red half-donut sitting above the "o" (the "movement shape")
 *
 * Variants control the colour split:
 *   - default     "Rajl" dark + "o"/arc red          (full-colour brand)
 *   - white       everything white                    (over dark/photo)
 *   - monoblack   everything dark                     (mono on light)
 *   - monored     everything red                       (special accent)
 */

type LogoSize = "sm" | "md" | "lg" | "xl";
type LogoVariant = "default" | "white" | "monoblack" | "monored";

type LogoProps = {
  size?: LogoSize;
  variant?: LogoVariant;
  /** Show italic "Let's go!" tagline next to the wordmark. */
  tagline?: boolean;
  /** Set to null to render as a plain inline element (no link wrap). */
  href?: string | null;
  className?: string;
};

const sizes: Record<
  LogoSize,
  { height: number; tag: string; gap: string }
> = {
  // Aspect ratio of the wordmark SVG = 343.32 / 173.36 ≈ 1.98.
  // We size by height; width auto-derives in the SVG.
  sm: { height: 22, tag: "text-[10px]", gap: "gap-[6px]" },
  md: { height: 32, tag: "text-[12px]", gap: "gap-[8px]" },
  lg: { height: 48, tag: "text-[16px]", gap: "gap-[10px]" },
  xl: { height: 72, tag: "text-[22px]", gap: "gap-[14px]" },
};

function colorsFor(
  variant: LogoVariant,
): { letters: string; mark: string; tagline: string } {
  switch (variant) {
    case "white":
      return { letters: "#ffffff", mark: "#ffffff", tagline: "#ffffff" };
    case "monoblack":
      return { letters: "#111906", mark: "#111906", tagline: "#111906" };
    case "monored":
      return { letters: "#f10100", mark: "#f10100", tagline: "#f10100" };
    case "default":
    default:
      // Letter colour + tagline colour follow CSS variables that flip
      // when the page is in dark mode (defined in globals.css). Brand
      // mark stays red. Result: white "Rajl" letters + white "Let's
      // go!" tagline on the dark theme; original Rajlo-black on the
      // light theme. Other variants keep their fixed values for
      // consistent rendering on overlays / brand surfaces.
      return {
        letters: "var(--logo-letters)",
        mark: "#f10100",
        tagline: "var(--logo-tagline)",
      };
  }
}

/**
 * Full Rajlo wordmark — letters + brand "o" + arc.
 */
export function Logo({
  size = "md",
  variant = "default",
  tagline = false,
  href = "/",
  className = "",
}: LogoProps) {
  const s = sizes[size];
  const c = colorsFor(variant);

  const inner = (
    <span
      className={`inline-flex items-center ${s.gap} leading-none ${className}`}
    >
      <Wordmark height={s.height} letterColor={c.letters} markColor={c.mark} />
      {tagline && (
        <span
          className={`${s.tag} font-medium italic tracking-wide`}
          style={{ color: c.tagline }}
          aria-hidden
        >
          Let&apos;s go!
        </span>
      )}
      <span className="sr-only">Rajlo{tagline ? " — Let's go!" : ""}</span>
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} aria-label="Rajlo — Let's go!" className="inline-flex">
      {inner}
    </Link>
  );
}

/**
 * Inline-SVG wordmark using the official path data from
 * `public/Rajlo main logo.svg`. We split the colours by index so the
 * letter group and the brand-mark group can recolour independently.
 */
function Wordmark({
  height,
  letterColor,
  markColor,
}: {
  height: number;
  letterColor: string;
  markColor: string;
}) {
  // Original viewBox 0 0 343.32 173.36 — keep aspect for crisp scaling.
  // We pass colours via inline `style.fill` instead of the SVG `fill`
  // attribute because SVG attribute values don't accept CSS `var()`
  // tokens — only inline-style fills do. That's how the default
  // variant's letter colour can flip between dark + white themes via
  // the `--logo-letters` variable defined in globals.css.
  const width = Math.round(height * (343.32 / 173.36));
  const letterStyle = { fill: letterColor };
  const markStyle = { fill: markColor };
  return (
    <svg
      role="img"
      aria-hidden="true"
      width={width}
      height={height}
      viewBox="0 0 343.32 173.36"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(-133.9 -316.11)">
        {/* Letter R */}
        <path
          style={letterStyle}
          d="M133.9,324.46h43.34c31.5,0,39.51,19,39.51,34.46,0,15.67-11.66,30.46-30.29,32.55l35,56.22H200.56l-31.33-54.3H150.61v54.3H133.9Zm16.71,54.31h21.93c13.23,0,26.45-3.14,26.45-19.85s-13.22-19.84-26.45-19.84H150.61Z"
        />
        {/* Letter a */}
        <path
          style={letterStyle}
          d="M223.54,375.28c8.7-8.18,21.23-12.18,32.72-12.18,24.37,0,34.46,13.23,34.46,27.5v42.12a127.52,127.52,0,0,0,.7,15H277.49q-.51-6.26-.52-12.53h-.35c-7,10.62-16.36,14.62-28.89,14.62-15.32,0-28.54-8.7-28.54-24.71,0-21.24,20.36-28.55,45.42-28.55H276.1V393c0-8.53-6.26-17.41-19.67-17.41-12,0-17.75,5.05-23.49,9.4ZM267.75,408c-14.8,0-32.9,2.61-32.9,15.84,0,9.4,7,13.4,17.75,13.4,17.41,0,23.5-12.88,23.5-24V408Z"
        />
        {/* Letter j */}
        <path
          style={letterStyle}
          d="M317.35,365.19v94.34c0,8.53-.17,29.94-25.24,29.94A28.45,28.45,0,0,1,282,487.9l1.74-14.45a20.18,20.18,0,0,0,6.44,1.4c8.53,0,11.49-5.57,11.49-16V365.19Zm-7.83-41.08A11.49,11.49,0,1,1,298,335.6,11.59,11.59,0,0,1,309.52,324.11Z"
        />
        {/* Letter l */}
        <path
          style={letterStyle}
          d="M330.41,316.11h15.66V447.69H330.41Z"
        />
        {/* O — hollow circle, brand-mark colour */}
        <path
          style={markStyle}
          d="M413.75,363.1c24.55,0,43.87,19.32,43.87,43.34s-19.32,43.34-43.87,43.34-43.86-19.32-43.86-43.34S389.21,363.1,413.75,363.1Zm0,72.06c16.71,0,27.16-12,27.16-28.72s-10.45-28.72-27.16-28.72-27.15,12-27.15,28.72S397,435.16,413.75,435.16Z"
        />
        {/* Arc above the O */}
        <path
          style={markStyle}
          d="M413.53,339.93a64.37,64.37,0,0,0-63.7,55.7H365a49.27,49.27,0,0,1,97,0h15.18A64.37,64.37,0,0,0,413.53,339.93Z"
        />
      </g>
    </svg>
  );
}

/**
 * Just the brand mark (the "o" ring + arc above it) — without the
 * "Rajl" letters. Use as favicon-style avatar, loading state, watermark.
 *
 * The `className` accepts a Tailwind text colour (e.g. `text-rajlo-red`,
 * `text-white`) — colour is inherited via `fill="currentColor"`.
 */
export function LogoIcon({
  height = 32,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  // Tight viewBox around just the o + arc shapes (paths 5 + 6, in the
  // wordmark's pre-translate coordinate space). This crops out the
  // letters cleanly and lets the icon size from a single height value.
  const width = Math.round(height * (130 / 115));
  return (
    <svg
      role="img"
      aria-hidden="true"
      width={width}
      height={height}
      viewBox="349 339 130 115"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* O ring */}
      <path
        fill="currentColor"
        d="M413.75,363.1c24.55,0,43.87,19.32,43.87,43.34s-19.32,43.34-43.87,43.34-43.86-19.32-43.86-43.34S389.21,363.1,413.75,363.1Zm0,72.06c16.71,0,27.16-12,27.16-28.72s-10.45-28.72-27.16-28.72-27.15,12-27.15,28.72S397,435.16,413.75,435.16Z"
      />
      {/* Arc */}
      <path
        fill="currentColor"
        d="M413.53,339.93a64.37,64.37,0,0,0-63.7,55.7H365a49.27,49.27,0,0,1,97,0h15.18A64.37,64.37,0,0,0,413.53,339.93Z"
      />
    </svg>
  );
}

/**
 * Driver-app variant — same wordmark, but with a stylized dashed lane
 * line through the "o" to evoke a road. Reserved for the driver surface
 * per brand guidelines.
 */
export function LogoDriver({
  size = "md",
  variant = "default",
  className = "",
  href = "/driver",
}: {
  size?: LogoSize;
  variant?: LogoVariant;
  className?: string;
  href?: string | null;
}) {
  const s = sizes[size];
  const c = colorsFor(variant);

  const inner = (
    <span
      className={`inline-flex items-center ${s.gap} leading-none ${className}`}
    >
      <DriverWordmark
        height={s.height}
        letterColor={c.letters}
        markColor={c.mark}
      />
      <span className="sr-only">Rajlo Driver</span>
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} aria-label="Rajlo Driver" className="inline-flex">
      {inner}
    </Link>
  );
}

function DriverWordmark({
  height,
  letterColor,
  markColor,
}: {
  height: number;
  letterColor: string;
  markColor: string;
}) {
  const width = Math.round(height * (343.32 / 173.36));
  // Same trick as the main wordmark — inline `style.fill` so CSS
  // variables in the default variant resolve correctly.
  const letterStyle = { fill: letterColor };
  const markStyle = { fill: markColor };
  return (
    <svg
      role="img"
      aria-hidden="true"
      width={width}
      height={height}
      viewBox="0 0 343.32 173.36"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(-133.9 -316.11)">
        <path
          style={letterStyle}
          d="M133.9,324.46h43.34c31.5,0,39.51,19,39.51,34.46,0,15.67-11.66,30.46-30.29,32.55l35,56.22H200.56l-31.33-54.3H150.61v54.3H133.9Zm16.71,54.31h21.93c13.23,0,26.45-3.14,26.45-19.85s-13.22-19.84-26.45-19.84H150.61Z"
        />
        <path
          style={letterStyle}
          d="M223.54,375.28c8.7-8.18,21.23-12.18,32.72-12.18,24.37,0,34.46,13.23,34.46,27.5v42.12a127.52,127.52,0,0,0,.7,15H277.49q-.51-6.26-.52-12.53h-.35c-7,10.62-16.36,14.62-28.89,14.62-15.32,0-28.54-8.7-28.54-24.71,0-21.24,20.36-28.55,45.42-28.55H276.1V393c0-8.53-6.26-17.41-19.67-17.41-12,0-17.75,5.05-23.49,9.4ZM267.75,408c-14.8,0-32.9,2.61-32.9,15.84,0,9.4,7,13.4,17.75,13.4,17.41,0,23.5-12.88,23.5-24V408Z"
        />
        <path
          style={letterStyle}
          d="M317.35,365.19v94.34c0,8.53-.17,29.94-25.24,29.94A28.45,28.45,0,0,1,282,487.9l1.74-14.45a20.18,20.18,0,0,0,6.44,1.4c8.53,0,11.49-5.57,11.49-16V365.19Zm-7.83-41.08A11.49,11.49,0,1,1,298,335.6,11.59,11.59,0,0,1,309.52,324.11Z"
        />
        <path
          style={letterStyle}
          d="M330.41,316.11h15.66V447.69H330.41Z"
        />
        <path
          style={markStyle}
          d="M413.75,363.1c24.55,0,43.87,19.32,43.87,43.34s-19.32,43.34-43.87,43.34-43.86-19.32-43.86-43.34S389.21,363.1,413.75,363.1Zm0,72.06c16.71,0,27.16-12,27.16-28.72s-10.45-28.72-27.16-28.72-27.15,12-27.15,28.72S397,435.16,413.75,435.16Z"
        />
        <path
          style={markStyle}
          d="M413.53,339.93a64.37,64.37,0,0,0-63.7,55.7H365a49.27,49.27,0,0,1,97,0h15.18A64.37,64.37,0,0,0,413.53,339.93Z"
        />
        {/* Dashed lane line through the "o" — driver-only motif. The
           dashes are always white so they read as road markings on
           top of the red "o". */}
        <line
          x1="380"
          y1="406"
          x2="448"
          y2="406"
          stroke="#ffffff"
          strokeWidth="3"
          strokeDasharray="5 5"
        />
      </g>
    </svg>
  );
}
