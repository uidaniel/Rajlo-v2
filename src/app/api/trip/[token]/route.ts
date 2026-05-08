import { NextResponse } from "next/server";
import { getTripShareData } from "@/lib/trip-share-data";

/**
 * GET /api/trip/[token]
 *
 * PUBLIC endpoint — anyone with the link can read this. We trust the
 * unguessable token as the auth credential.
 *
 * Returns a stripped-down view: pickup/dropoff, status, ETA, driver
 * name + plate + verified selfie, and an `expiresOnEnd` flag so
 * clients know the link self-revokes when the trip ends.
 *
 * The lookup logic lives in `lib/trip-share-data` so the same query
 * powers `generateMetadata` on the public-share layout (used for
 * WhatsApp / iMessage / Slack OG card previews).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const trip = await getTripShareData(token);
  if (!trip) {
    return NextResponse.json(
      { error: "Trip no longer available" },
      { status: 404 },
    );
  }

  // Map server-shape into the legacy wire format consumed by the
  // public-share page client. Same fields as before — keeps the
  // page working without changes.
  return NextResponse.json({
    rideId: trip.rideId,
    status: trip.status,
    pickup: trip.pickup,
    dropoff: trip.dropoff,
    stops: trip.stops,
    estimatedEtaMinutes: trip.estimatedEtaMinutes,
    driver: trip.driver,
    recipientLabel: trip.recipientLabel,
    // Timeline removed from this endpoint since the page never used
    // those fields visibly. If we add a public timeline later, plumb
    // them back through `TripShareView`.
  });
}
