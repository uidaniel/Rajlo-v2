import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * POST /api/driver/route-taxi/sessions/end
 *
 * Ends the driver's currently-active Route Taxi session. Any hails
 * still in `accepted` or `picked_up` MUST be completed first — the
 * driver shouldn't be able to wipe an in-progress trip by ending the
 * session. We surface that as a 409 with the open hail count so the
 * UI can prompt them to settle each one.
 */
export async function POST() {
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
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const { data: driver } = await supabase
    .from("drivers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json(
      { error: "Driver record not found" },
      { status: 404 },
    );
  }

  const { data: session } = await supabase
    .from("driver_sessions")
    .select("id, seats_taken")
    .eq("driver_id", driver.id)
    .eq("status", "active")
    .maybeSingle();

  if (!session) {
    return NextResponse.json(
      { error: "No active session to end." },
      { status: 404 },
    );
  }

  // Block end if there are riders still onboard or accepted-but-not-picked.
  const { count: openHails } = await supabase
    .from("route_hails")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .in("status", ["accepted", "picked_up"]);

  if ((openHails ?? 0) > 0) {
    return NextResponse.json(
      {
        error: "open_hails",
        message: `Settle ${openHails} open hail${openHails === 1 ? "" : "s"} before ending the session.`,
        openHails,
      },
      { status: 409 },
    );
  }

  // Cancel any still-`requested` hails attached to this session (riders
  // had matched but never boarded). They get unmatched and can re-hail
  // the next driver. Then close the session.
  await supabase
    .from("route_hails")
    .update({ session_id: null })
    .eq("session_id", session.id)
    .eq("status", "requested");

  const { error: updateError } = await supabase
    .from("driver_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", session.id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
