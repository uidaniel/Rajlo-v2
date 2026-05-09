import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAuthServerClient } from "./supabase-auth-server";
import { getSupabaseServerClient } from "./supabase-server";

/**
 * Shared admin route gatekeeper.
 *
 * Every admin API endpoint should call `requireAdmin()` first — it
 * returns either an `error` response to send back, or a populated
 * `actor` + `supabase` (service-role) client ready to use. This keeps
 * the auth pattern in one place instead of copy-pasted across each
 * route handler.
 *
 * Returns:
 *   - { error: NextResponse }  — caller should immediately return the response
 *   - { actor, supabase }       — caller is authenticated as admin, proceed
 */

export type AdminActor = {
  userId: string;
  label: string;
  email: string | null;
};

type RequireAdminResult =
  | { error: NextResponse; actor?: never; supabase?: never }
  | { error?: never; actor: AdminActor; supabase: SupabaseClient };

export async function requireAdmin(): Promise<RequireAdminResult> {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await auth
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return {
      error: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      error: NextResponse.json(
        { error: "Service role not configured" },
        { status: 500 },
      ),
    };
  }

  return {
    actor: {
      userId: user.id,
      label: profile.full_name ?? user.email ?? "Admin",
      email: user.email ?? null,
    },
    supabase,
  };
}

/**
 * Append a row to admin_audit_logs. Fire-and-forget — failures are
 * logged but don't block the calling request, since the underlying
 * action (the user delete, the deactivation, etc.) has already
 * succeeded.
 */
export async function logAdminAction(
  supabase: SupabaseClient,
  actor: AdminActor,
  entry: {
    targetType: "rider" | "driver" | "admin" | "ride" | "system";
    targetId?: string | null;
    targetLabel?: string | null;
    action: string;
    summary: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("admin_audit_logs").insert({
    actor_id: actor.userId,
    actor_label: actor.label,
    target_type: entry.targetType,
    target_id: entry.targetId ?? null,
    target_label: entry.targetLabel ?? null,
    action: entry.action,
    summary: entry.summary,
    metadata: entry.metadata ?? null,
  });
  if (error) {
    console.error("admin_audit_logs insert failed:", error.message);
  }
}
