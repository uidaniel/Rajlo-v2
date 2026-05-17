import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";

/**
 * GET /api/admin/moderation
 *
 * Moderation dashboard data — gated by `view_incidents` (every
 * moderation tier holds it):
 *   - recentActions: the latest enforcement actions taken
 *   - activeHolds:   unreleased driver payout holds
 */

type ProfileRow = { id: string; full_name: string | null };

export async function GET() {
  const gate = await requirePermission("view_incidents");
  if (gate.error) return gate.error;
  const { supabase } = gate;

  const [{ data: actions }, { data: holds }] = await Promise.all([
    supabase
      .from("moderation_actions")
      .select(
        "id, admin_label, target_user_id, target_label, action_type, reason, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("payout_holds")
      .select(
        "id, driver_user_id, reason, hold_amount, created_by_label, created_at",
      )
      .is("released_at", null)
      .order("created_at", { ascending: false }),
  ]);

  // Resolve driver names for the active holds.
  const holdRows = holds ?? [];
  const nameById = new Map<string, string>();
  if (holdRows.length > 0) {
    const { data: names } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...new Set(holdRows.map((h) => h.driver_user_id as string))]);
    for (const p of (names ?? []) as ProfileRow[]) {
      nameById.set(p.id, p.full_name ?? "Unnamed driver");
    }
  }

  return NextResponse.json({
    recentActions: (actions ?? []).map((a) => ({
      id: a.id,
      admin: a.admin_label ?? "Admin",
      targetUserId: a.target_user_id,
      targetName: a.target_label ?? "Unnamed user",
      actionType: a.action_type,
      reason: a.reason,
      createdAt: a.created_at,
    })),
    activeHolds: holdRows.map((h) => ({
      id: h.id,
      driverUserId: h.driver_user_id,
      driverName: nameById.get(h.driver_user_id as string) ?? "Unnamed driver",
      reason: h.reason,
      holdAmount: h.hold_amount,
      createdBy: h.created_by_label ?? "Admin",
      createdAt: h.created_at,
    })),
  });
}
