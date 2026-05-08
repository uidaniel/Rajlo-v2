/**
 * Inline-SVG chart primitives for the rider analytics page.
 *
 * Deliberately library-free — these are simple visual displays
 * (bars + filled rows), so dragging in a charting library would add
 * 30-100KB of JS for no real benefit. SVG scales to retina, themes
 * with currentColor / Tailwind classes, and stays accessible.
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
                      : "text-rajlo-black opacity-0 group-hover:opacity-100"
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
