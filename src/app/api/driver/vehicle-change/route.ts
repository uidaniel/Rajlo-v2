import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { validateVehicleSpec } from "@/lib/vehicle-catalog";

/**
 * GET /api/driver/vehicle-change
 *   Returns the driver's most recent vehicle-change request (any
 *   status). The driver portal page uses this to pre-fill in-flight
 *   pending requests + show the "we got it" state after submission.
 *
 * POST /api/driver/vehicle-change
 *   Submits a new request. Validates the spec against the catalog,
 *   requires the three core compliance docs (registration, COF,
 *   insurance) by storage path, and rejects if a pending request
 *   already exists (the schema also enforces this via partial
 *   unique index — we just give a friendlier error here).
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

  const { data: driver } = await supabase
    .from("drivers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: latest } = await supabase
    .from("vehicle_change_requests")
    .select(
      "id, status, requested_type, requested_brand, requested_model, requested_year, requested_color, requested_plate, note, admin_note, submitted_at, reviewed_at",
    )
    .eq("driver_id", driver.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ request: latest ?? null });
}

type PostBody = {
  type?: unknown;
  brand?: unknown;
  model?: unknown;
  year?: unknown;
  color?: unknown;
  plate?: unknown;
  note?: unknown;
  insurancePath?: unknown;
  registrationPath?: unknown;
  cofPath?: unknown;
};

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

  const { data: driver } = await supabase
    .from("drivers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as PostBody;

  // Catalog validation — same helper used by the admin approve
  // handler, so the rules are enforced symmetrically.
  const yearNum =
    typeof body.year === "string"
      ? Number(body.year)
      : typeof body.year === "number"
        ? body.year
        : NaN;
  const validationError = validateVehicleSpec({
    type: typeof body.type === "string" ? body.type : null,
    brand: typeof body.brand === "string" ? body.brand : null,
    model: typeof body.model === "string" ? body.model : null,
    year: Number.isFinite(yearNum) ? yearNum : null,
    color: typeof body.color === "string" ? body.color : null,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Required document paths — must point to files in the
  // driver-documents bucket. RLS already restricted the upload to
  // the driver's own folder, so we just need to confirm a path was
  // provided for each of the three core docs.
  const insurancePath =
    typeof body.insurancePath === "string" ? body.insurancePath.trim() : "";
  const registrationPath =
    typeof body.registrationPath === "string"
      ? body.registrationPath.trim()
      : "";
  const cofPath = typeof body.cofPath === "string" ? body.cofPath.trim() : "";
  if (!insurancePath || !registrationPath || !cofPath) {
    return NextResponse.json(
      {
        error:
          "Upload all three documents: registration, COF, and PPV insurance.",
      },
      { status: 400 },
    );
  }

  // Friendly check for an in-flight request — the partial unique
  // index would also catch this with a 23505, but a clean 409
  // reads better client-side.
  const { data: existing } = await supabase
    .from("vehicle_change_requests")
    .select("id")
    .eq("driver_id", driver.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      {
        error:
          "You already have a pending vehicle change. Wait for the review or cancel it first.",
      },
      { status: 409 },
    );
  }

  const plate =
    typeof body.plate === "string" && body.plate.trim().length > 0
      ? body.plate.trim().slice(0, 20)
      : null;
  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 500)
      : null;

  const { data: created, error: insertError } = await supabase
    .from("vehicle_change_requests")
    .insert({
      driver_id: driver.id,
      status: "pending",
      requested_type: body.type as string,
      requested_brand: body.brand as string,
      requested_model: body.model as string,
      requested_year: yearNum,
      requested_color: body.color as string,
      requested_plate: plate,
      insurance_path: insurancePath,
      registration_path: registrationPath,
      cof_path: cofPath,
      note,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    return NextResponse.json(
      { error: insertError?.message ?? "Couldn't submit request" },
      { status: 500 },
    );
  }

  // Audit trail on the driver record so the admin sees this in
  // context next to other driver activity.
  await supabase.from("driver_audit_logs").insert({
    driver_id: driver.id,
    actor_role: "driver",
    actor_id: user.id,
    event: `Vehicle change requested: ${body.brand} ${body.model} (${yearNum})`,
  });

  return NextResponse.json({ ok: true, requestId: created.id });
}

/**
 * DELETE /api/driver/vehicle-change
 *   Driver-cancels their own pending request before review. We
 *   transition it to `cancelled` rather than hard-deleting so the
 *   audit trail is preserved.
 */
export async function DELETE() {
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

  const { data: driver } = await supabase
    .from("drivers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: cancelled } = await supabase
    .from("vehicle_change_requests")
    .update({ status: "cancelled" })
    .eq("driver_id", driver.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!cancelled) {
    return NextResponse.json(
      { error: "No pending request to cancel." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
