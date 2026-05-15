/**
 * Human-readable ETA / duration formatter.
 *
 * Used by the rider booking screen, fare breakdown, and map ETA
 * bubbles. Plain "391 min" is unreadable past the 60-minute mark —
 * a rider has to do mental long-division to know if their trip is
 * "this afternoon" or "tomorrow morning". Showing "6h 31m" answers
 * that at a glance.
 *
 * Format rules:
 *   - 0 minutes  → "<1 min"   (the trip is on us)
 *   - 1..59      → "X min"
 *   - 60..       → "Xh Ym" (or "Xh" when Y is 0)
 *
 * Always rounds the input to a whole minute first — half-minutes in
 * an ETA never read naturally.
 */
export function formatEta(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 1) return "<1 min";
  if (m < 60) return `${m} min`;
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
