import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * PATCH /api/rider/notifications/[id]
 *
 * Mark a single notification read. The body is a no-op — we hit this
 * route purely to flip read_at on the targeted row. RLS scopes the
 * update to the calling user's own rows, so a rider can't mark
 * someone else's notification read.
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  const { error } = await supabase
    .from("rider_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("rider_id", user.id)
    .is("read_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
