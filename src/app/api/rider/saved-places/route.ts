import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET  /api/rider/saved-places  → list the rider's saved destinations
 * POST /api/rider/saved-places  → create one
 *
 * (PATCH + DELETE for a specific row live in `[id]/route.ts`.)
 *
 * Body shape for POST:
 *   {
 *     label: string,           // free-form, e.g. "Mum's house"
 *     kind: "home" | "work" | "office" | "school" | "gym" | "other",
 *     placeName: string,
 *     placeAddress: string,
 *     lat: number,
 *     lng: number,
 *     parish?: string,
 *     placeId?: string         // Google Places id
 *   }
 *
 * The schema enforces:
 *   - One row per (user, kind) for canonical labels — second "Home"
 *     attempt 409s with a clear message
 *   - Label length 1..32 — long labels would blow out the chip strip
 */

const VALID_KINDS = ["home", "work", "office", "school", "gym", "other"] as const;
type Kind = (typeof VALID_KINDS)[number];

type SavedPlaceRow = {
  id: string;
  label: string;
  kind: Kind;
  place_name: string;
  place_address: string;
  lat: number;
  lng: number;
  parish: string | null;
  place_id: string | null;
  created_at: string;
  updated_at: string;
};

function toWire(r: SavedPlaceRow) {
  return {
    id: r.id,
    label: r.label,
    kind: r.kind,
    placeName: r.place_name,
    placeAddress: r.place_address,
    lat: r.lat,
    lng: r.lng,
    parish: r.parish,
    placeId: r.place_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function GET() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("saved_places")
    .select(
      "id, label, kind, place_name, place_address, lat, lng, parish, place_id, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    places: (data ?? []).map((r) => toWire(r as SavedPlaceRow)),
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const kind = (typeof body.kind === "string" ? body.kind : "other") as Kind;
  const placeName = typeof body.placeName === "string" ? body.placeName.trim() : "";
  const placeAddress =
    typeof body.placeAddress === "string" ? body.placeAddress.trim() : "";
  const lat = typeof body.lat === "number" ? body.lat : NaN;
  const lng = typeof body.lng === "number" ? body.lng : NaN;
  const parish = typeof body.parish === "string" ? body.parish : null;
  const placeId = typeof body.placeId === "string" ? body.placeId : null;

  if (!label || label.length > 32) {
    return NextResponse.json(
      { error: "Label is required and must be 32 characters or fewer." },
      { status: 400 },
    );
  }
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: `Kind must be one of: ${VALID_KINDS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!placeName || !placeAddress || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "placeName, placeAddress, lat, and lng are required." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("saved_places")
    .insert({
      user_id: user.id,
      label,
      kind,
      place_name: placeName,
      place_address: placeAddress,
      lat,
      lng,
      parish,
      place_id: placeId,
    })
    .select(
      "id, label, kind, place_name, place_address, lat, lng, parish, place_id, created_at, updated_at",
    )
    .single();
  if (error) {
    // Unique-violation when the rider already has a Home/Work/Office —
    // surface a clear 409 instead of the raw constraint name.
    if (error.code === "23505") {
      return NextResponse.json(
        {
          error: `You already have a saved ${kind}. Edit the existing one instead.`,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ place: toWire(data as SavedPlaceRow) });
}
