import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * PATCH /api/rider/safety-alerts/[id]
 *
 * Lets the rider close out their own safety alert from the safety-check
 * modal. Two flavours:
 *
 *   - `{ status: "resolved", resolution_note?: "I'm fine" }`
 *     Used when the rider dismisses an unusual-stop check by tapping
 *     "I'm fine". The alert stays in the DB for ops visibility but
 *     status flips to resolved so it drops off the open queue.
 *
 *   - `{ status: "open", note: "..." }`
 *     Used when the rider updates the alert with additional context
 *     (e.g. tapping "Notify Rajlo team" appends a contextual note).
 *
 * Rider can only touch their own alerts. Ops use a separate admin
 * endpoint for acknowledge / cross-resolve.
 */

type Body = {
  status?: "resolved" | "open";
  resolution_note?: string;
  message?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Body;

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

  // Verify ownership.
  const { data: alert } = await supabase
    .from("safety_alerts")
    .select("id, rider_id, status, kind")
    .eq("id", id)
    .maybeSingle();
  if (!alert || alert.rider_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (body.status === "resolved") {
    update.status = "resolved";
    update.resolved_at = new Date().toISOString();
    if (typeof body.resolution_note === "string") {
      update.resolution_note = body.resolution_note.trim().slice(0, 500);
    }
  }
  if (typeof body.message === "string" && body.message.trim().length > 0) {
    update.message = body.message.trim().slice(0, 1000);
  }
  update.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("safety_alerts")
    .update(update)
    .eq("id", alert.id)
    .eq("rider_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
