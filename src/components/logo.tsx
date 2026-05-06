import Link from "next/link";

type LogoSize = "sm" | "md" | "lg" | "xl";
type LogoVariant = "default" | "white" | "monoblack" | "monored";

type LogoProps = {
  size?: LogoSize;
  variant?: LogoVariant;
  tagline?: boolean;
  href?: string | null;
  className?: string;
};

const sizes: Record<LogoSize, { height: number; text: string; tag: string; gap: string }> = {
  sm: { height: 22, text: "text-[20px]", tag: "text-[10px]", gap: "gap-[3px]" },
  md: { height: 32, text: "text-[28px]", tag: "text-[12px]", gap: "gap-[4px]" },
  lg: { height: 48, text: "text-[44px]", tag: "text-[16px]", gap: "gap-[6px]" },
  xl: { height: 72, text: "text-[68px]", tag: "text-[22px]", gap: "gap-[8px]" },
};

function colorsFor(variant: LogoVariant) {
  switch (variant) {
    case "white":
      return { raj: "text-white", lo: "text-white", icon: "text-white" };
    case "monoblack":
      return { raj: "text-rajlo-black", lo: "text-rajlo-black", icon: "text-rajlo-black" };
    case "monored":
      return { raj: "text-rajlo-red", lo: "text-rajlo-red", icon: "text-rajlo-red" };
    case "default":
    default:
      return { raj: "text-rajlo-red", lo: "text-rajlo-black", icon: "text-rajlo-black" };
  }
}

/**
 * Rajlo wordmark.
 * "Raj" in red + "l" in black + the special arc-and-O icon, all on one baseline.
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
    <span className={`inline-flex items-end ${s.gap} font-extrabold leading-none tracking-tight ${className}`}>
      <span className={`${c.raj} ${s.text}`}>Raj</span>
      <span className={`${c.lo} ${s.text}`}>l</span>
      <LogoIcon className={c.icon} height={s.height} />
      {tagline && (
        <span
          className={`${c.lo} ${s.tag} ml-[6px] mb-[2px] font-medium italic opacity-90`}
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
 * Just the arc + ring icon mark (no wordmark). Use as favicon-style avatar,
 * loading state, or watermark element.
 */
export function LogoIcon({
  height = 32,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  // Aspect ratio of the icon: ~1.05:1 (slightly taller than wide isn't quite right —
  // actually wider, since arc extends laterally beyond the o).
  const width = Math.round(height * 1);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="14"
      strokeLinecap="butt"
      className={className}
      aria-hidden="true"
    >
      {/* Top half-donut arc — the "movement shape" */}
      <path d="M 14 38 A 36 36 0 0 1 86 38" />
      {/* The "O" ring */}
      <circle cx="50" cy="62" r="22" />
    </svg>
  );
}

/**
 * Driver-app variant: same wordmark but with a stylized road/lane line through
 * the "o" instead of a clean ring. Per brand guidelines this is reserved for
 * the driver app surface only.
 */
export function LogoDriver({
  size = "md",
  className = "",
  href = "/driver",
}: {
  size?: LogoSize;
  className?: string;
  href?: string | null;
}) {
  const s = sizes[size];
  const inner = (
    <span className={`inline-flex items-end ${s.gap} font-extrabold leading-none tracking-tight ${className}`}>
      <span className={`text-rajlo-red ${s.text}`}>Raj</span>
      <span className={`text-rajlo-black ${s.text}`}>l</span>
      <LogoDriverIcon height={s.height} />
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

function LogoDriverIcon({ height = 32 }: { height?: number }) {
  const width = Math.round(height * 1);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      fill="none"
      className="text-rajlo-black"
      aria-hidden="true"
    >
      {/* Top arc */}
      <path
        d="M 14 38 A 36 36 0 0 1 86 38"
        stroke="currentColor"
        strokeWidth="14"
        fill="none"
      />
      {/* O ring */}
      <circle cx="50" cy="62" r="22" stroke="currentColor" strokeWidth="14" fill="none" />
      {/* Dashed lane line through the O — the "road" */}
      <line
        x1="22"
        y1="62"
        x2="78"
        y2="62"
        stroke="white"
        strokeWidth="3"
        strokeDasharray="4 4"
      />
    </svg>
  );
}
