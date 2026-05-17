import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * POST /api/admin/security/beacon
 *
 * Pinged once by the admin portal shell when an admin session loads.
 * Records an `admin_access_logs` entry — the access history shown on
 * the security dashboard — capturing IP + user-agent.
 *
 * De-duplicated: at most one row per admin per hour, so a refresh or
 * quick re-navigation doesn't flood the log.
 */

function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { actor, supabase } = gate;

  // De-dupe: skip if this admin already has an access row in the last
  // hour.
  const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await supabase
    .from("admin_access_logs")
    .select("id", { count: "exact", head: true })
    .eq("admin_user_id", actor.userId)
    .gte("created_at", oneHourAgo);

  if (count && count > 0) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  await supabase.from("admin_access_logs").insert({
    admin_user_id: actor.userId,
    ip_address: clientIp(request),
    user_agent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
  });

  return NextResponse.json({ ok: true });
}
