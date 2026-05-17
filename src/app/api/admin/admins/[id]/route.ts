import { NextResponse } from "next/server";
import { requirePermission, logAdminAction } from "@/lib/admin-auth";
import {
  ADMIN_ROLE_LABEL,
  asAdminRole,
  type AdminRole,
} from "@/lib/admin-rbac";

/**
 * PATCH /api/admin/admins/[id]
 *
 * Super-admin only (`manage_admins`). Changes a target admin's RBAC
 * tier and/or suspends/unsuspends their access.
 *
 * Body: { adminRole?: AdminRole, suspended?: boolean }
 *
 * Every change is recorded three ways for the governance trail:
 *   - admin_permission_changes  (focused before/after of the role)
 *   - admin_security_events     (the security feed)
 *   - admin_audit_logs          (the platform-wide audit feed)
 */

type Body = { adminRole?: unknown; suspended?: unknown };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requirePermission("manage_admins");
  if (gate.error) return gate.error;
  const { actor, supabase } = gate;

  const { id: targetId } = await params;

  // An admin can't change their own tier or suspend themselves — that
  // removes the standard "two-person" footing and risks self-lockout.
  if (targetId === actor.userId) {
    return NextResponse.json(
      { error: "You can't change your own admin role or access." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;

  // Parse the requested role into a definite AdminRole (or undefined
  // when not being changed) — an invalid value is rejected here so the
  // rest of the handler never has to consider a null role.
  let nextRole: AdminRole | undefined;
  if (body.adminRole !== undefined) {
    const parsed = asAdminRole(String(body.adminRole));
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid admin role." },
        { status: 400 },
      );
    }
    nextRole = parsed;
  }

  const nextSuspended =
    typeof body.suspended === "boolean" ? body.suspended : undefined;

  if (nextRole === undefined && nextSuspended === undefined) {
    return NextResponse.json(
      { error: "Nothing to change." },
      { status: 400 },
    );
  }

  // Target must be an existing admin.
  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, role, admin_role, admin_suspended")
    .eq("id", targetId)
    .maybeSingle();
  if (!target || target.role !== "admin") {
    return NextResponse.json(
      { error: "That user is not an admin." },
      { status: 404 },
    );
  }

  const prevRole = asAdminRole(target.admin_role as string | null);
  const targetLabel = (target.full_name as string | null) ?? "Admin";
  const update: Record<string, unknown> = {};
  if (nextRole !== undefined) update.admin_role = nextRole;
  if (nextSuspended !== undefined) update.admin_suspended = nextSuspended;

  const { error: updateError } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", targetId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // ─── Governance trail ───
  if (nextRole !== undefined && nextRole !== prevRole) {
    await supabase.from("admin_permission_changes").insert({
      changed_by: actor.userId,
      changed_by_label: actor.label,
      target_admin_id: targetId,
      target_label: targetLabel,
      previous_role: prevRole,
      new_role: nextRole,
    });
    await supabase.from("admin_security_events").insert({
      admin_user_id: actor.userId,
      event_type: "permission_changed",
      severity: "warning",
      description: `${actor.label} changed ${targetLabel}'s role from ${
        prevRole ? ADMIN_ROLE_LABEL[prevRole] : "none"
      } to ${ADMIN_ROLE_LABEL[nextRole]}`,
      metadata: { targetId, previousRole: prevRole, newRole: nextRole },
    });
  }
  if (nextSuspended !== undefined && nextSuspended !== target.admin_suspended) {
    await supabase.from("admin_security_events").insert({
      admin_user_id: actor.userId,
      event_type: nextSuspended ? "admin_suspended" : "admin_reinstated",
      severity: "critical",
      description: `${actor.label} ${
        nextSuspended ? "suspended" : "reinstated"
      } admin access for ${targetLabel}`,
      metadata: { targetId },
    });
  }

  await logAdminAction(supabase, actor, {
    targetType: "admin",
    targetId,
    targetLabel,
    action: "admin_access_changed",
    summary: `${actor.label} updated admin ${targetLabel}${
      nextRole !== undefined ? ` — role: ${ADMIN_ROLE_LABEL[nextRole]}` : ""
    }${
      nextSuspended !== undefined
        ? ` — ${nextSuspended ? "suspended" : "reinstated"}`
        : ""
    }`,
  });

  return NextResponse.json({ ok: true });
}
