import { getSupabaseServerClient } from "./supabase-server";
import { getDriverSelfieUrl } from "./driver-selfie";

/**
 * Server-side helper for the public trip-share view. Used both by the
 * `/api/trip/[token]` JSON endpoint AND by `/trip/[token]/layout`'s
 * `generateMetadata` (so unfurled OG previews on WhatsApp / Slack /
 * iMessage can include real trip details).
 *
 * Returns a normalized object the caller can shape further. Null when
 * the token is missing/revoked/expired so the caller can render the
 * appropriate error state.
 */

export type TripShareView = {
  rideId: string;
  status:
    | "requested"
    | "accepted"
    | "arrived"
    | "in_progress"
    | "completed"
    | "cancelled";
  pickup: { name: string; lat: number; lng: number };
  dropoff: { name: string; lat: number; lng: number };
  /** Intermediate stops in the order the driver visits them. Empty
   *  array for a simple A → B trip. */
  stops: Array<{
    position: number;
    name: string;
    lat: number;
    lng: number;
  }>;
  estimatedEtaMinutes: number | null;
  driver: {
    name: string;
    plateNumber: string | null;
    vehicle: string | null;
    vehicleMake: string | null;
    vehicleModel: string | null;
    vehicleYear: number | null;
    vehicleColor: string | null;
    avatarUrl: string | null;
  } | null;
  recipientLabel: string | null;
  riderFirstName: string | null;
};

export async function getTripShareData(
  token: string,
): Promise<TripShareView | null> {
  if (!token || token.length < 16) return null;

  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data: link } = await supabase
    .from("trip_share_links")
    .select("ride_id, revoked_at, recipient_label")
    .eq("token", token)
    .maybeSingle();
  if (!link || link.revoked_at) return null;

  const { data: ride } = await supabase
    .from("rides")
    .select(
      "id, status, rider_id, pickup_name, pickup_lat, pickup_lng, dropoff_name, dropoff_lat, dropoff_lng, driver_id, estimated_eta_minutes",
    )
    .eq("id", link.ride_id)
    .maybeSingle();
  if (!ride) return null;

  /* Driver block — same precedence as the live-trip endpoint:
     verified TA selfie if available, else OAuth profile picture. */
  let driver: TripShareView["driver"] = null;
  if (ride.driver_id) {
    const { data: d } = await supabase
      .from("drivers")
      .select(
        "first_name, last_name, plate_number, vehicle_make, vehicle_model, vehicle_year, vehicle_color, user_id",
      )
      .eq("id", ride.driver_id)
      .maybeSingle();
    if (d) {
      const [{ data: profile }, selfieUrl] = await Promise.all([
        d.user_id
          ? supabase
              .from("profiles")
              .select("avatar_url")
              .eq("id", d.user_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        getDriverSelfieUrl(supabase, ride.driver_id),
      ]);
      const vehicleParts = [
        d.vehicle_year ? String(d.vehicle_year) : null,
        d.vehicle_color,
        d.vehicle_make,
        d.vehicle_model,
      ].filter(Boolean);
      driver = {
        name:
          [d.first_name, d.last_name].filter(Boolean).join(" ") || "Driver",
        plateNumber: d.plate_number,
        vehicle: vehicleParts.length > 0 ? vehicleParts.join(" ") : null,
        vehicleMake: d.vehicle_make,
        vehicleModel: d.vehicle_model,
        vehicleYear: d.vehicle_year,
        vehicleColor: d.vehicle_color,
        avatarUrl: selfieUrl ?? profile?.avatar_url ?? null,
      };
    }
  }

  /* Rider's first name — for the OG title (e.g. "Track Marlon's
     ride · Rajlo"). Only first name to keep PII minimal. */
  let riderFirstName: string | null = null;
  const { data: riderProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ride.rider_id)
    .maybeSingle();
  riderFirstName = riderProfile?.full_name?.split(" ")[0] ?? null;

  /* Intermediate stops — needed so multi-stop trips render correctly
     on the share view (markers + route line) and in the route list. */
  const { data: stopRows } = await supabase
    .from("ride_stops")
    .select("position, name, lat, lng")
    .eq("ride_id", ride.id)
    .order("position", { ascending: true });

  return {
    rideId: ride.id,
    status: ride.status as TripShareView["status"],
    pickup: {
      name: ride.pickup_name,
      lat: ride.pickup_lat,
      lng: ride.pickup_lng,
    },
    dropoff: {
      name: ride.dropoff_name,
      lat: ride.dropoff_lat,
      lng: ride.dropoff_lng,
    },
    stops: (stopRows ?? []).map((s) => ({
      position: s.position,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
    })),
    estimatedEtaMinutes: ride.estimated_eta_minutes,
    driver,
    recipientLabel: link.recipient_label,
    riderFirstName,
  };
}

/**
 * Build a Google Static Maps URL with the route + markers for pickup,
 * each intermediate stop (in order), and dropoff. The image is
 * publicly cacheable on Google's CDN so we can hand the URL straight
 * to og:image.
 *
 * Returns null when the API key is missing — caller should fall back
 * to a static brand image.
 */
export function buildStaticMapImageUrl(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
  stops: Array<{ lat: number; lng: number }> = [],
): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const params = new URLSearchParams({
    size: "1200x630",
    scale: "2",
    maptype: "roadmap",
    key,
  });

  // Pickup (green A), each stop (black B/C/...), dropoff (red final
  // letter). Static Maps caps total marker labels at single chars, so
  // anything past the 24-letter alphabet gets a numeric placeholder —
  // not a real concern given Rajlo allows max 4 stops per ride.
  params.append(
    "markers",
    `color:0x10b981|label:A|${pickup.lat},${pickup.lng}`,
  );
  stops.forEach((s, i) => {
    const label = String.fromCharCode(66 + i); // B, C, D, ...
    params.append(
      "markers",
      `color:0x111906|label:${label}|${s.lat},${s.lng}`,
    );
  });
  const finalLabel = String.fromCharCode(66 + stops.length);
  params.append(
    "markers",
    `color:0xf10100|label:${finalLabel}|${dropoff.lat},${dropoff.lng}`,
  );

  // Path goes in the same order. Joins all the waypoints with a red
  // line so the preview reads as a route, not just a pin scatter.
  const pathPoints = [
    `${pickup.lat},${pickup.lng}`,
    ...stops.map((s) => `${s.lat},${s.lng}`),
    `${dropoff.lat},${dropoff.lng}`,
  ].join("|");
  params.append("path", `color:0xf10100ff|weight:5|${pathPoints}`);

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}
