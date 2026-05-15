import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * PATCH  /api/rider/saved-places/[id]  → update label / kind / place
 * DELETE /api/rider/saved-places/[id]  → remove a saved place
 *
 * RLS already restricts these to the rider's own rows, so we don't
 * need an explicit auth.uid() check in the WHERE — but we still bail
 * out for an unauthenticated request.
 */

const VALID_KINDS = ["home", "work", "office", "school", "gym", "other"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  if (typeof body.label === "string") {
    const trimmed = body.label.trim();
    if (!trimmed || trimmed.length > 32) {
      return NextResponse.json(
        { error: "Label must be between 1 and 32 characters." },
        { status: 400 },
      );
    }
    update.label = trimmed;
  }
  if (typeof body.kind === "string") {
    if (!VALID_KINDS.includes(body.kind as (typeof VALID_KINDS)[number])) {
      return NextResponse.json(
        { error: `Kind must be one of: ${VALID_KINDS.join(", ")}` },
        { status: 400 },
      );
    }
    update.kind = body.kind;
  }
  if (typeof body.placeName === "string") update.place_name = body.placeName.trim();
  if (typeof body.placeAddress === "string")
    update.place_address = body.placeAddress.trim();
  if (typeof body.lat === "number") update.lat = body.lat;
  if (typeof body.lng === "number") update.lng = body.lng;
  if (body.parish === null || typeof body.parish === "string")
    update.parish = body.parish;
  if (body.placeId === null || typeof body.placeId === "string")
    update.place_id = body.placeId;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabase
    .from("saved_places")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You already have a saved place with that kind." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { error } = await supabase
    .from("saved_places")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
