/**
 * Inline-SVG chart primitives. Used by the rider analytics page,
 * driver dashboard, AND the admin operations + analytics surfaces.
 *
 * Deliberately library-free — these are simple visual displays, so
 * dragging in recharts/chart.js would add 30-100KB of JS for no real
 * benefit. SVG scales to retina, themes with currentColor / Tailwind
 * classes, and stays accessible.
 *
 * Available primitives:
 *   - MonthlyBars      vertical bars (single series)
 *   - StackedBars      vertical bars with multiple stacked series
 *   - AreaChart        smooth area + line (good for trend over time)
 *   - Sparkline        compact inline trendline for stat tiles
 *   - DonutChart       slice ring with centre label (status mix etc.)
 *   - PieChart         filled slices, no hole
 *   - Heatmap          24×7 hour-of-day × day-of-week grid
 *   - ProgressRow      labelled horizontal bar
 *   - StatNumber       compact metric tile with delta indicator
 */

import { formatJMD } from "@/lib/jamaica";

/* ──────────────────────────────────────────────────────────────────────
   MonthlyBars — vertical bars for monthly spending trend
   ────────────────────────────────────────────────────────────────────── */

type BarPoint = { label: string; spendJMD: number; trips: number };

export function MonthlyBars({ data }: { data: BarPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.spendJMD));
  const lastIdx = data.length - 1;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
            Last 12 months
          </p>
          <p className="mt-1 text-sm font-bold">Monthly spend</p>
        </div>
        <p className="text-[11px] text-muted">
          Bar height = JMD spent · current month highlighted
        </p>
      </div>

      <div className="flex items-end gap-1.5 sm:gap-2.5" role="img" aria-label="Monthly spend chart">
        {data.map((d, i) => {
          const isLast = i === lastIdx;
          const heightPct = max > 0 ? Math.max(2, (d.spendJMD / max) * 100) : 2;
          return (
            <div
              key={d.label}
              className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
            >
              {/* The bar itself: its parent is a fixed-height rail so
                  every bar shares a baseline. Bar grows from the
                  bottom. JMD label appears on hover for desktop, and
                  on the last bar it's always visible since "current
                  month" is the most relevant number. */}
              <div className="relative flex h-32 w-full items-end justify-center sm:h-40">
                <span
                  className={`absolute -top-5 whitespace-nowrap text-[9px] font-bold transition-opacity ${
                    isLast
                      ? "text-rajlo-red opacity-100"
                      : "text-foreground opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {d.spendJMD > 0 ? formatJMD(d.spendJMD) : ""}
                </span>
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 ${
                    isLast
                      ? "bg-rajlo-red shadow-md shadow-rajlo-red/30"
                      : d.spendJMD > 0
                        ? "bg-rajlo-black/85 group-hover:bg-rajlo-red"
                        : "bg-line"
                  }`}
                  style={{ height: `${heightPct}%` }}
                  aria-label={`${d.label}: ${d.spendJMD > 0 ? formatJMD(d.spendJMD) : "no trips"}`}
                />
              </div>
              <p
                className={`truncate text-[10px] font-semibold ${
                  isLast ? "text-rajlo-red" : "text-muted"
                }`}
              >
                {d.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   ProgressRow — labelled horizontal bar (used for parish breakdown,
   route distribution, etc.)
   ────────────────────────────────────────────────────────────────────── */

export function ProgressRow({
  label,
  caption,
  spendJMD,
  share,
  rank,
}: {
  label: string;
  caption?: string;
  spendJMD: number;
  /** 0..1 — proportion of the largest row in this list. */
  share: number;
  rank?: number;
}) {
  const pct = Math.max(2, Math.min(100, share * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {rank !== undefined && (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-soft text-[10px] font-extrabold text-rajlo-red">
              {rank}
            </span>
          )}
          <p className="truncate text-sm font-bold">{label}</p>
        </div>
        <p className="shrink-0 text-sm font-extrabold tracking-tight text-rajlo-red">
          {formatJMD(spendJMD)}
        </p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-soft">
        <div
          className="h-full rounded-full bg-rajlo-red transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {caption && (
        <p className="text-[11px] text-muted">{caption}</p>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   StatNumber — compact number tile with optional change indicator
   ────────────────────────────────────────────────────────────────────── */

export function StatNumber({
  eyebrow,
  value,
  caption,
  changePct,
  invertColors = false,
}: {
  eyebrow: string;
  value: string;
  caption?: string;
  /** -ve = down, +ve = up, null = no comparison data, 0 = unchanged. */
  changePct?: number | null;
  /** When true, "down" reads as good (e.g. spend went down) and uses
   *  green; "up" uses red. Default: up = green, down = red. */
  invertColors?: boolean;
}) {
  const tone =
    changePct === null || changePct === undefined
      ? null
      : changePct === 0
        ? "neutral"
        : (changePct > 0) === !invertColors
          ? "good"
          : "bad";

  const toneClass =
    tone === "good"
      ? "text-emerald-700 bg-emerald-50"
      : tone === "bad"
        ? "text-rajlo-red bg-primary-soft"
        : "text-muted bg-surface-soft";

  const arrow =
    tone === null
      ? null
      : changePct! > 0
        ? "▲"
        : changePct! < 0
          ? "▼"
          : "—";

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
        {eyebrow}
      </p>
      <p className="mt-1.5 text-2xl font-extrabold tracking-tight md:text-3xl">
        {value}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        {caption && (
          <p className="truncate text-[11px] text-muted">{caption}</p>
        )}
        {tone && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${toneClass}`}
          >
            {arrow} {Math.abs(changePct!)}%
          </span>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   AreaChart — smooth filled area for time-series (rides per day, etc.)
   ────────────────────────────────────────────────────────────────────── */

export type AreaPoint = { label: string; value: number };

export function AreaChart({
  data,
  height = 160,
  caption,
  formatValue,
  accent = "red",
}: {
  data: AreaPoint[];
  height?: number;
  caption?: string;
  formatValue?: (v: number) => string;
  accent?: "red" | "black" | "emerald";
}) {
  const w = 600;
  const h = height;
  const padX = 8;
  const padY = 16;
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? (w - padX * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padY + (h - padY * 2) * (1 - d.value / max);
    return { x, y, ...d };
  });

  // Build a smooth path using Catmull-Rom → Bezier conversion.
  const pathD =
    points.length === 0
      ? ""
      : points
          .map((p, i, arr) => {
            if (i === 0) return `M ${p.x} ${p.y}`;
            const prev = arr[i - 1];
            const cpx = (prev.x + p.x) / 2;
            return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
          })
          .join(" ");

  const fillD = pathD
    ? `${pathD} L ${points[points.length - 1].x} ${h - padY} L ${points[0].x} ${h - padY} Z`
    : "";

  const stroke =
    accent === "red"
      ? "stroke-rajlo-red"
      : accent === "black"
        ? "stroke-rajlo-black"
        : "stroke-emerald-600";
  const fill =
    accent === "red"
      ? "fill-rajlo-red/10"
      : accent === "black"
        ? "fill-rajlo-black/10"
        : "fill-emerald-500/10";
  const dotFill =
    accent === "red"
      ? "fill-rajlo-red"
      : accent === "black"
        ? "fill-rajlo-black"
        : "fill-emerald-600";

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-full w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={caption ?? "Area chart"}
      >
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={padX}
            x2={w - padX}
            y1={padY + (h - padY * 2) * g}
            y2={padY + (h - padY * 2) * g}
            className="stroke-line"
            strokeDasharray="3,4"
            strokeWidth={1}
          />
        ))}
        {fillD && <path d={fillD} className={fill} />}
        {pathD && (
          <path d={pathD} fill="none" className={stroke} strokeWidth={2.5} />
        )}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} className={dotFill} />
            <title>
              {p.label}: {formatValue ? formatValue(p.value) : p.value}
            </title>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-muted">
        {data.length > 0 && (
          <>
            <span>{data[0].label}</span>
            {data.length > 6 && (
              <span>{data[Math.floor(data.length / 2)].label}</span>
            )}
            <span>{data[data.length - 1].label}</span>
          </>
        )}
      </div>
      {caption && <p className="mt-1 text-[11px] text-muted">{caption}</p>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Sparkline — compact trendline for stat tiles
   ────────────────────────────────────────────────────────────────────── */

export function Sparkline({
  data,
  className = "h-8 w-24",
  accent = "red",
}: {
  data: number[];
  className?: string;
  accent?: "red" | "black" | "emerald" | "muted";
}) {
  const w = 100;
  const h = 32;
  const max = Math.max(1, ...data);
  const min = Math.min(0, ...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? w / (data.length - 1) : 0;

  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  const stroke =
    accent === "red"
      ? "stroke-rajlo-red"
      : accent === "black"
        ? "stroke-rajlo-black"
        : accent === "emerald"
          ? "stroke-emerald-600"
          : "stroke-muted";

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        className={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   DonutChart — slice ring with centre label (status mix, vehicle type)
   ────────────────────────────────────────────────────────────────────── */

export type DonutSlice = {
  label: string;
  value: number;
  color: string; // tailwind text class — e.g. "text-rajlo-red"
};

export function DonutChart({
  data,
  size = 180,
  thickness = 22,
  centreLabel,
  centreValue,
}: {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centreLabel?: string;
  centreValue?: string;
}) {
  const total = data.reduce((sum, s) => sum + s.value, 0);
  const radius = size / 2 - thickness / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Pre-compute the offset for each wedge so we don't reassign a `let`
  // during render (the react-hooks/immutability rule blocks that).
  const offsetByIndex: number[] = [];
  data.reduce((acc, s, i) => {
    offsetByIndex[i] = acc;
    return acc + (s.value / Math.max(1, total)) * circumference;
  }, 0);

  return (
    <div className="flex flex-col items-center gap-4 md:flex-row md:items-center md:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          className="-rotate-90"
          role="img"
          aria-label="Donut chart"
        >
          {/* track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            className="stroke-line"
            strokeWidth={thickness}
          />
          {total > 0 &&
            data.map((slice, i) => {
              const len = (slice.value / total) * circumference;
              const dash = `${len} ${circumference - len}`;
              const dashOffset = -offsetByIndex[i];
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  className={slice.color}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                />
              );
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-extrabold tracking-tight md:text-3xl">
            {centreValue ?? total}
          </p>
          {centreLabel && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {centreLabel}
            </p>
          )}
        </div>
      </div>
      <ul className="grid w-full gap-2 text-sm md:flex-1">
        {data.map((slice, i) => {
          const pct = total > 0 ? (slice.value / total) * 100 : 0;
          return (
            <li key={i} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`h-3 w-3 shrink-0 rounded-sm bg-current ${slice.color}`}
                />
                <span className="truncate font-semibold">{slice.label}</span>
              </div>
              <span className="shrink-0 text-xs font-bold text-muted">
                {slice.value} · {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   PieChart — filled wedges (no hole) for compact mix display
   ────────────────────────────────────────────────────────────────────── */

export function PieChart({
  data,
  size = 140,
}: {
  data: DonutSlice[];
  size?: number;
}) {
  const total = data.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <div
        className="grid place-items-center rounded-full bg-surface-soft text-xs text-muted"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  // Pre-compute the running total per wedge so the render path is
  // pure (the lint rule blocks reassigning a `let` after render).
  const cumulativeByIndex: number[] = [];
  data.reduce((acc, s, i) => {
    cumulativeByIndex[i] = acc + s.value;
    return acc + s.value;
  }, 0);

  const wedges = data.map((slice, i) => {
    const startTotal = i === 0 ? 0 : cumulativeByIndex[i - 1];
    const startAngle = (startTotal / total) * 2 * Math.PI;
    const endAngle = (cumulativeByIndex[i] / total) * 2 * Math.PI;
    const x1 = cx + r * Math.sin(startAngle);
    const y1 = cy - r * Math.cos(startAngle);
    const x2 = cx + r * Math.sin(endAngle);
    const y2 = cy - r * Math.cos(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const d =
      slice.value === total
        ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return (
      <path
        key={i}
        d={d}
        fill="currentColor"
        className={slice.color}
        stroke="white"
        strokeWidth={1}
      >
        <title>
          {slice.label}: {slice.value}
        </title>
      </path>
    );
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="Pie chart"
    >
      {wedges}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   StackedBars — multi-series vertical bars (e.g. completed vs cancelled)
   ────────────────────────────────────────────────────────────────────── */

export type StackedPoint = {
  label: string;
  segments: { value: number; color: string; name: string }[];
};

export function StackedBars({ data }: { data: StackedPoint[] }) {
  const max = Math.max(
    1,
    ...data.map((d) => d.segments.reduce((sum, s) => sum + s.value, 0)),
  );

  return (
    <div className="flex h-40 items-end gap-1.5 md:gap-2.5">
      {data.map((d, i) => {
        const total = d.segments.reduce((sum, s) => sum + s.value, 0);
        const heightPct = max > 0 ? Math.max(2, (total / max) * 100) : 2;
        return (
          <div
            key={i}
            className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            <div className="relative flex h-full w-full items-end justify-center">
              <span className="absolute -top-5 whitespace-nowrap text-[9px] font-bold text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {total}
              </span>
              <div
                className="flex w-full flex-col-reverse overflow-hidden rounded-t-lg"
                style={{ height: `${heightPct}%` }}
              >
                {d.segments.map((s, j) => {
                  const segPct = total > 0 ? (s.value / total) * 100 : 0;
                  return (
                    <div
                      key={j}
                      className={`bg-current ${s.color}`}
                      style={{ height: `${segPct}%` }}
                      title={`${s.name}: ${s.value}`}
                    />
                  );
                })}
              </div>
            </div>
            <p className="truncate text-[10px] font-semibold text-muted">
              {d.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Heatmap — hour-of-day × day-of-week activity (24x7 cells)
   ────────────────────────────────────────────────────────────────────── */

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Heatmap({
  /** [day_of_week (0-6, 0=Sun)][hour (0-23)] = count */
  matrix,
  caption,
}: {
  matrix: number[][];
  caption?: string;
}) {
  const max = Math.max(1, ...matrix.flat());

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="flex">
          <div className="w-10 shrink-0" />
          <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="text-center text-[8px] font-semibold text-muted"
              >
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
          </div>
        </div>
        {DAY_LABELS.map((label, day) => (
          <div key={day} className="mt-[2px] flex items-center">
            <div className="w-10 shrink-0 pr-2 text-right text-[10px] font-bold text-muted">
              {label}
            </div>
            <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
              {Array.from({ length: 24 }, (_, hour) => {
                const v = matrix[day]?.[hour] ?? 0;
                const intensity = v / max;
                const opacity =
                  v === 0
                    ? 0
                    : Math.max(0.12, Math.min(1, 0.12 + intensity * 0.88));
                return (
                  <div
                    key={hour}
                    className="aspect-square rounded-[2px] bg-rajlo-red"
                    style={{ opacity }}
                    title={`${label} ${hour}:00 — ${v} ride${v === 1 ? "" : "s"}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
        {caption && (
          <p className="mt-3 text-[11px] text-muted">{caption}</p>
        )}
      </div>
    </div>
  );
}

