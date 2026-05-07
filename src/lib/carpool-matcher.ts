/**
 * Carpool matcher — given a freshly-created ride that opted into
 * sharing, find an existing `requested` ride that's compatible and
 * link them.
 *
 * Run synchronously inside POST /api/rider/rides. We deliberately
 * keep the algorithm cheap (no PostGIS, no async pubsub queue): a
 * partial-indexed query against the open-pool view is plenty for MVP
 * volumes. If we ever care about thousands of concurrent matches we
 * can move this into a worker + earst-N-K-NN index.
 *
 * "Compatible" means:
 *   - Both opted in (allow_carpool = true)
 *   - Both still `requested` and unmatched
 *   - Combined seats fit in a 4-seat car
 *   - Pickups within MATCH_PICKUP_RADIUS_KM
 *   - Dropoffs within MATCH_DROPOFF_RADIUS_KM
 *   - Direction vectors point roughly the same way (cosine similarity
 *     ≥ MATCH_DIRECTION_COS) — this is what stops us pairing two
 *     riders going *opposite* ways down the same road.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineKm } from "./jamaica";

/** Kilometres apart that pickups can be and still be considered "the same area". */
const MATCH_PICKUP_RADIUS_KM = 2.5;
/** Kilometres apart for dropoffs — slightly looser since the destinations
 *  diverge naturally as you fan out (e.g. both heading to "downtown" but
 *  ending up on different streets). */
const MATCH_DROPOFF_RADIUS_KM = 3.0;
/** Cosine of the angle between the two riders' travel vectors. ≥0.7
 *  ≈ within ~45° of each other — strict enough to weed out "this
 *  rider is going north, the other south" but loose enough to allow
 *  small route divergence. */
const MATCH_DIRECTION_COS = 0.7;
/** Hard seat cap — a 4-seater car. Reject the match if combined seats
 *  would force the driver to leave someone on the curb. */
const MAX_GROUP_SEATS = 4;

/** Discount applied to BOTH riders' fares once a match is locked in.
 *  35% off each = total revenue is 130% of one solo ride, which still
 *  leaves the driver with more than a single trip while the riders
 *  each save meaningfully. Pricing is a product call — easy to tweak. */
export const CARPOOL_FARE_MULTIPLIER = 0.65;

export type MatchableRide = {
  id: string;
  rider_id: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  seats: number;
  estimated_fare_jmd: number;
};

/**
 * Vector dot-product / |a||b| — measures how aligned two travel
 * directions are. We use lat/lng deltas as a flat 2D vector; over the
 * short distances of a Jamaica trip this is fine without converting
 * to true bearings.
 */
function directionCosineSimilarity(
  a: { dLat: number; dLng: number },
  b: { dLat: number; dLng: number },
): number {
  const magA = Math.hypot(a.dLat, a.dLng);
  const magB = Math.hypot(b.dLat, b.dLng);
  if (magA === 0 || magB === 0) return 0;
  return (a.dLat * b.dLat + a.dLng * b.dLng) / (magA * magB);
}

/**
 * Try to find a partner for `newRide` and link them into a carpool
 * group. Returns the match info if successful, or null if no compatible
 * ride was found.
 *
 * Uses the service-role client so we can update both rides atomically
 * without RLS getting in the way. Caller is expected to have already
 * verified `newRide.allow_carpool === true`.
 */
export async function tryMatchCarpool(
  supabase: SupabaseClient,
  newRide: MatchableRide,
): Promise<{
  groupId: string;
  partnerRideId: string;
  partnerRiderId: string;
  newFareJMD: number;
  partnerFareJMD: number;
} | null> {
  // Pull all open-pool carpool candidates. The partial index
  // `idx_rides_carpool_open` keeps this cheap.
  // We fetch all candidates rather than filter in SQL because the
  // direction/distance checks need lat/lng math that's clearer in JS.
  // For MVP volumes (≤dozens of concurrent open-pool rides) this is
  // fine. If it grows, push to a Postgres function.
  const { data: candidates, error } = await supabase
    .from("rides")
    .select(
      "id, rider_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, seats, estimated_fare_jmd",
    )
    .eq("status", "requested")
    .eq("allow_carpool", true)
    .is("carpool_group_id", null)
    .neq("id", newRide.id)
    .neq("rider_id", newRide.rider_id) // never match a rider with themselves
    .order("requested_at", { ascending: true });

  if (error || !candidates || candidates.length === 0) return null;

  const newDir = {
    dLat: newRide.dropoff_lat - newRide.pickup_lat,
    dLng: newRide.dropoff_lng - newRide.pickup_lng,
  };

  // Pick the FIRST compatible candidate (oldest open ride). This
  // gives a fairness/FIFO property — the rider who's been waiting
  // longest gets matched first, rather than always pairing with the
  // newest opt-in.
  const match = candidates.find((c) => {
    if (c.seats + newRide.seats > MAX_GROUP_SEATS) return false;
    const pickupKm = haversineKm(
      { lat: c.pickup_lat, lng: c.pickup_lng },
      { lat: newRide.pickup_lat, lng: newRide.pickup_lng },
    );
    if (pickupKm > MATCH_PICKUP_RADIUS_KM) return false;
    const dropoffKm = haversineKm(
      { lat: c.dropoff_lat, lng: c.dropoff_lng },
      { lat: newRide.dropoff_lat, lng: newRide.dropoff_lng },
    );
    if (dropoffKm > MATCH_DROPOFF_RADIUS_KM) return false;
    const candDir = {
      dLat: c.dropoff_lat - c.pickup_lat,
      dLng: c.dropoff_lng - c.pickup_lng,
    };
    return directionCosineSimilarity(newDir, candDir) >= MATCH_DIRECTION_COS;
  });

  if (!match) return null;

  // Create the group row.
  const { data: group, error: groupError } = await supabase
    .from("carpool_groups")
    .insert({ status: "matched" })
    .select("id")
    .single();
  if (groupError || !group) return null;

  // Apply the discount to both fares + link both rides to the group.
  // The OLDER candidate is the "primary" — they were here first and
  // the route is anchored around their original pickup/dropoff order.
  const newFareJMD = Math.max(
    400, // never go below the platform's minimum fare
    Math.round((newRide.estimated_fare_jmd * CARPOOL_FARE_MULTIPLIER) / 50) *
      50,
  );
  const partnerFareJMD = Math.max(
    400,
    Math.round((match.estimated_fare_jmd * CARPOOL_FARE_MULTIPLIER) / 50) * 50,
  );

  // Update the two rides. Race protection: scope the UPDATE to
  // status='requested' AND carpool_group_id IS NULL so a concurrent
  // matcher can't double-link. If either update affects 0 rows we
  // dissolve the group and return null.
  const updateNew = supabase
    .from("rides")
    .update({
      carpool_group_id: group.id,
      carpool_role: "secondary",
      estimated_fare_jmd: newFareJMD,
    })
    .eq("id", newRide.id)
    .eq("status", "requested")
    .is("carpool_group_id", null)
    .select("id");

  const updatePartner = supabase
    .from("rides")
    .update({
      carpool_group_id: group.id,
      carpool_role: "primary",
      estimated_fare_jmd: partnerFareJMD,
    })
    .eq("id", match.id)
    .eq("status", "requested")
    .is("carpool_group_id", null)
    .select("id");

  const [{ data: newOk }, { data: partnerOk }] = await Promise.all([
    updateNew,
    updatePartner,
  ]);

  if (!newOk?.length || !partnerOk?.length) {
    // One of the updates lost the race — back out the group row and
    // also the link on whichever ride did succeed (if any). The
    // ON DELETE SET NULL on rides.carpool_group_id will null out the
    // FK automatically when we delete the group, so a single delete is
    // sufficient cleanup.
    await supabase.from("carpool_groups").delete().eq("id", group.id);
    return null;
  }

  return {
    groupId: group.id,
    partnerRideId: match.id,
    partnerRiderId: match.rider_id,
    newFareJMD,
    partnerFareJMD,
  };
}
