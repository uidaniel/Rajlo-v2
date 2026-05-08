/**
 * Single source of truth for the rider-side request timeout. Real
 * rideshare networks tune this in the 3-7 minute range — long
 * enough that a driver getting a ping while parked has time to
 * react, short enough that a rider stuck in dead zones doesn't wait
 * forever. 5 minutes is a fine starting point; revisit once we have
 * real volume data.
 */
export const RIDE_REQUEST_TIMEOUT_SECONDS = 300; // 5 minutes

/**
 * Compute when a freshly-created ride request should expire. Used
 * by the create-ride endpoint to stamp `expires_at` at insert time.
 */
export function computeRideExpiry(now: Date = new Date()): string {
  return new Date(
    now.getTime() + RIDE_REQUEST_TIMEOUT_SECONDS * 1000,
  ).toISOString();
}

/**
 * Cancellation reason used when a request expires without a match.
 * Kept as a constant so the frontend's "no driver found" check
 * doesn't drift from the API's write.
 */
export const EXPIRED_REASON = "expired_no_driver";
