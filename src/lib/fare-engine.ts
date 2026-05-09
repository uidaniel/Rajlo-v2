/**
 * Rajlo fare engine — Route Taxi (Mode B).
 *
 * Single source of truth for every Route Taxi quote in the platform.
 * Anchored to the Transport Authority of Jamaica's published fare
 * schedule effective 2023-10-15 (see
 * `/public/ROUTE TAXI FARE INCREASE 2023_updated.pdf`).
 *
 * If TA increases the rates again, change the two constants below and
 * re-run `node scripts/verify-fare-engine.mjs`. Nothing else needs to
 * move.
 *
 * Mode A (Private Ride) uses a separate calculation — never reuse this
 * function for it.
 */

/** Flag-fall — covers the first kilometre of every route taxi trip. */
export const ROUTE_TAXI_BASE_RATE_JMD = 113;

/** Per-kilometre rate added on top of the base. */
export const ROUTE_TAXI_RATE_PER_KM_JMD = 7;

/**
 * The TA quotes every fare to the nearest $10 (so $215 → $220, $214 →
 * $210). A passenger or inspector wouldn't compute anything finer.
 */
export const ROUTE_TAXI_ROUNDING_JMD = 10;

/**
 * Compute the regulated route taxi fare for a trip of `distanceKm`.
 *
 *   fare = round10( BASE_RATE + (distance × RATE_PER_KM) )
 *
 * Worked example from the TA notice (must hold true):
 *   15 km → 113 + (15 × 7) = 218 → **$220** rounded to nearest $10
 *
 * Rounding is half-up at the $5 boundary so a fare of $215 returns
 * $220 — matching how a human cashier quotes it. Banker's rounding
 * would silently give $210 for the same input, which is wrong against
 * the published table.
 *
 * Throws if `distanceKm` is negative or non-finite. A zero-distance
 * trip is technically valid (the base rate stands) — used for the
 * "minimum charge" surface in the rider quote UI.
 */
export function calculateRouteFare(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error(
      `calculateRouteFare: distanceKm must be a finite, non-negative number (got ${distanceKm})`,
    );
  }
  const raw = ROUTE_TAXI_BASE_RATE_JMD + distanceKm * ROUTE_TAXI_RATE_PER_KM_JMD;
  return roundHalfUpToMultiple(raw, ROUTE_TAXI_ROUNDING_JMD);
}

/**
 * Returns the unrounded fare alongside the rounded one. Useful for the
 * rider's fare-breakdown screen so they can see how the rounding lands
 * (transparency builds trust).
 */
export function calculateRouteFareDetailed(distanceKm: number): {
  baseJmd: number;
  perKmJmd: number;
  distanceKm: number;
  rawFareJmd: number;
  roundedFareJmd: number;
} {
  const raw =
    ROUTE_TAXI_BASE_RATE_JMD + distanceKm * ROUTE_TAXI_RATE_PER_KM_JMD;
  return {
    baseJmd: ROUTE_TAXI_BASE_RATE_JMD,
    perKmJmd: ROUTE_TAXI_RATE_PER_KM_JMD,
    distanceKm,
    rawFareJmd: raw,
    roundedFareJmd: roundHalfUpToMultiple(raw, ROUTE_TAXI_ROUNDING_JMD),
  };
}

/**
 * TA grants half-fare to: children, students in uniform, physically
 * disabled, senior citizens. Exposed as a separate helper because the
 * concession is computed AFTER rounding the regular fare, then itself
 * snapped back to the nearest dollar (TA doesn't quote fractions).
 */
export function calculateConcessionFare(distanceKm: number): number {
  const full = calculateRouteFare(distanceKm);
  return Math.round(full / 2);
}

/**
 * Round-half-up to the nearest multiple of `step`. The standard
 * `Math.round` does banker's rounding for .5 in some engines and is
 * half-away-from-zero otherwise — neither matches the TA cashier
 * convention. We add 0.5 explicitly so 215 always rounds up to 220.
 */
function roundHalfUpToMultiple(value: number, step: number): number {
  return Math.floor(value / step + 0.5) * step;
}

/* ────────────────────── Commission split ──────────────────────
 * Rajlo's take on every completed trip — split between driver
 * earnings and platform commission. Applies to both Mode A and
 * Mode B (the percentage may diverge later if route taxi vs
 * private ride economics call for it).
 *
 * Stored as an integer percent so the JSON serialisation / admin
 * dashboards / driver "what you'll earn" copy all read the same
 * canonical number.
 */
export const RAJLO_COMMISSION_PCT = 15;

/**
 * Split a fare into `{ driverEarningsJmd, commissionJmd }`.
 *
 * Commission rounds to the nearest dollar (we never quote anything
 * finer than $1 to drivers). Driver earnings = fare − commission so
 * the two halves always sum to the gross — no penny-leaking edge
 * cases.
 */
export function splitFare(fareJmd: number): {
  driverEarningsJmd: number;
  commissionJmd: number;
} {
  if (!Number.isFinite(fareJmd) || fareJmd < 0) {
    throw new Error(
      `splitFare: fareJmd must be a non-negative number (got ${fareJmd})`,
    );
  }
  const commission = Math.round((fareJmd * RAJLO_COMMISSION_PCT) / 100);
  return {
    driverEarningsJmd: fareJmd - commission,
    commissionJmd: commission,
  };
}
