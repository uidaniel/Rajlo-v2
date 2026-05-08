import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/rider/trusted-contacts — list
 * POST /api/rider/trusted-contacts — create
 *
 * Per-user emergency / share-trip targets. Hard-capped at 5 per
 * rider, enforced by a Postgres trigger from the migration so a race
 * between two concurrent POSTs can't sneak above the limit.
 */

export async function GET() {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("trusted_contacts")
    .select("id, name, phone, relationship, created_at")
    .eq("rider_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ contacts: data ?? [] });
}

type CreateBody = {
  name?: unknown;
  phone?: unknown;
  relationship?: unknown;
};

const RELATIONSHIPS = new Set([
  "Family",
  "Partner",
  "Friend",
  "Roommate",
  "Other",
]);

export async function POST(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as CreateBody;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const relationship =
    typeof body.relationship === "string" && RELATIONSHIPS.has(body.relationship)
      ? body.relationship
      : "Family";

  if (!name || name.length > 60) {
    return NextResponse.json(
      { error: "Name is required (1–60 characters)." },
      { status: 400 },
    );
  }
  if (!phone || phone.length < 6 || phone.length > 30) {
    return NextResponse.json(
      { error: "Phone is required (6–30 characters)." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("trusted_contacts")
    .insert({
      rider_id: user.id,
      name,
      phone,
      relationship,
    })
    .select("id, name, phone, relationship, created_at")
    .single();

  if (error) {
    // The cap-trigger raises with errcode 23514 (check_violation).
    if (error.code === "23514") {
      return NextResponse.json(
        { error: "You've reached the limit of 5 trusted contacts." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contact: data });
}
