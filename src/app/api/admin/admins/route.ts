import { NextResponse } from "next/server";
import { requirePermission, logAdminAction } from "@/lib/admin-auth";
import { ADMIN_ROLE_LABEL, asAdminRole } from "@/lib/admin-rbac";

/**
 * POST /api/admin/admins
 *
 * Adds an admin — super-admin only (`manage_admins`).
 *
 * Body: { email, fullName?, adminRole }
 *
 * Handles both cases:
 *   - the email already has a RAJLO account  → promote it to admin
 *     with the chosen RBAC tier
 *   - the email is new                       → send a magic-link
 *     invite and create the admin profile
 *
 * Driver accounts can't be promoted — a driver needs a separate,
 * non-driving account for admin work (same rule as safety officers).
 */

type Body = { email?: unknown; fullName?: unknown; adminRole?: unknown };

export async function POST(request: Request) {
  const gate = await requirePermission("manage_admins");
  if (gate.error) return gate.error;
  const { actor, supabase } = gate;

  const body = (await request.json().catch(() => ({}))) as Body;
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName =
    typeof body.fullName === "string" ? body.fullName.trim() : "";
  const adminRole = asAdminRole(
    typeof body.adminRole === "string" ? body.adminRole : null,
  );

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }
  if (!adminRole) {
    return NextResponse.json(
      { error: "A valid admin role is required." },
      { status: 400 },
    );
  }

  // Look for an existing account with this email.
  const { data: list, error: listError } =
    await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }
  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === email,
  );

  let targetId: string;
  let promoted = false;

  if (existing) {
    // Account exists — check its current role before promoting.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", existing.id)
      .maybeSingle();
    if (profile?.role === "driver") {
      return NextResponse.json(
        {
          error:
            "That email belongs to a driver account. Drivers need a separate, non-driving account for admin access.",
        },
        { status: 400 },
      );
    }
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        role: "admin",
        admin_role: adminRole,
        admin_suspended: false,
        ...(fullName ? { full_name: fullName } : {}),
      })
      .eq("id", existing.id);
    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }
    targetId = existing.id;
    promoted = true;
  } else {
    // New email — send a magic-link invite, then create the profile.
    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required to invite a new admin." },
        { status: 400 },
      );
    }
    const { data: invited, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
      });
    if (inviteError || !invited?.user) {
      return NextResponse.json(
        { error: inviteError?.message ?? "Couldn't send the invite." },
        { status: 500 },
      );
    }
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: invited.user.id,
        full_name: fullName,
        role: "admin",
        admin_role: adminRole,
      },
      { onConflict: "id" },
    );
    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }
    targetId = invited.user.id;
  }

  const label = fullName || email;
  await supabase.from("admin_security_events").insert({
    admin_user_id: actor.userId,
    event_type: "admin_added",
    severity: "warning",
    description: `${actor.label} ${
      promoted ? "promoted" : "invited"
    } ${label} as ${ADMIN_ROLE_LABEL[adminRole]}`,
    metadata: { targetId, adminRole, viaInvite: !promoted },
  });
  await logAdminAction(supabase, actor, {
    targetType: "admin",
    targetId,
    targetLabel: label,
    action: "admin_added",
    summary: `${actor.label} ${
      promoted ? "promoted" : "invited"
    } ${label} as ${ADMIN_ROLE_LABEL[adminRole]}`,
  });

  return NextResponse.json({ ok: true, promoted });
}
