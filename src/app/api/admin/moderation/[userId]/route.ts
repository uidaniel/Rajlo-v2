import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { hasPermission, type AdminPermission } from "@/lib/admin-rbac";

/**
 * POST /api/admin/moderation/[userId]
 *
 * Takes an enforcement action against a rider or driver and records it
 * in `moderation_actions` (the append-only enforcement trail).
 *
 * Body: { action, reason?, holdAmount? }
 *   warning              — logged only (perm: suspend_user)
 *   temporary_suspension — 30-day auth ban  (perm: suspend_user)
 *   permanent_ban        — ~100-year auth ban (perm: ban_user)
 *   reinstatement        — lifts an auth ban (perm: suspend_user)
 *   payout_hold          — blocks the driver's payouts (perm: freeze_payout)
 *   release_payout_hold  — lifts payout holds  (perm: freeze_payout)
 *
 * Each action's permission is checked against the caller's RBAC tier.
 */

const ACTION_PERMISSION: Record<string, AdminPermission> = {
  warning: "suspend_user",
  temporary_suspension: "suspend_user",
  permanent_ban: "ban_user",
  reinstatement: "suspend_user",
  payout_hold: "freeze_payout",
  release_payout_hold: "freeze_payout",
};

const TEMP_BAN_DURATION = "720h"; // 30 days
const PERMANENT_BAN_DURATION = "876600h"; // ~100 years

type Body = { action?: unknown; reason?: unknown; holdAmount?: unknown };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { actor, supabase } = gate;
  const { userId } = await params;

  const body = (await request.json().catch(() => ({}))) as Body;
  const action = typeof body.action === "string" ? body.action : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  const permission = ACTION_PERMISSION[action];
  if (!permission) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  if (!hasPermission(actor.adminRole, permission)) {
    return NextResponse.json(
      { error: "insufficient_permission", permission },
      { status: 403 },
    );
  }

  if (userId === actor.userId) {
    return NextResponse.json(
      { error: "You can't take a moderation action against yourself." },
      { status: 400 },
    );
  }

  // Target must be a rider or driver.
  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .maybeSingle();
  if (!target || (target.role !== "rider" && target.role !== "driver")) {
    return NextResponse.json(
      { error: "Target must be a rider or driver." },
      { status: 404 },
    );
  }
  const targetLabel = (target.full_name as string | null) ?? "Unnamed user";

  // ─── Apply the enforcement ───
  if (action === "temporary_suspension" || action === "permanent_ban") {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration:
        action === "permanent_ban"
          ? PERMANENT_BAN_DURATION
          : TEMP_BAN_DURATION,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (action === "reinstatement") {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (action === "payout_hold") {
    if (target.role !== "driver") {
      return NextResponse.json(
        { error: "Payout holds apply to drivers only." },
        { status: 400 },
      );
    }
    if (!reason) {
      return NextResponse.json(
        { error: "A reason is required for a payout hold." },
        { status: 400 },
      );
    }
    const holdAmount =
      typeof body.holdAmount === "number" && body.holdAmount > 0
        ? body.holdAmount
        : null;
    await supabase.from("payout_holds").insert({
      driver_user_id: userId,
      reason,
      hold_amount: holdAmount,
      created_by: actor.userId,
      created_by_label: actor.label,
    });
  } else if (action === "release_payout_hold") {
    await supabase
      .from("payout_holds")
      .update({
        released_at: new Date().toISOString(),
        released_by: actor.userId,
      })
      .eq("driver_user_id", userId)
      .is("released_at", null);
  }
  // `warning` has no side effect beyond the recorded action below.

  // ─── Record the action (append-only enforcement trail) ───
  await supabase.from("moderation_actions").insert({
    admin_user_id: actor.userId,
    admin_label: actor.label,
    target_user_id: userId,
    target_label: targetLabel,
    action_type:
      action === "release_payout_hold" ? "payout_hold_released" : action,
    reason: reason || null,
  });

  await logAdminAction(supabase, actor, {
    targetType: target.role === "driver" ? "driver" : "rider",
    targetId: userId,
    targetLabel,
    action: `moderation_${action}`,
    summary: `${actor.label} applied ${action.replace(/_/g, " ")} to ${targetLabel}`,
  });

  return NextResponse.json({ ok: true });
}
