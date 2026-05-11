import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";

/**
 * Officer management. Admin-only — officers themselves can't promote
 * other officers (that would defeat the scope boundary).
 *
 *   GET   ?q=...  — search profiles by name / email, plus list current
 *                    officers regardless of the query so the admin can
 *                    see who's already promoted
 *   POST          — { userId: string, role: "safety_officer" | "rider" }
 *                    Flips a profile's role. "rider" reverts an officer
 *                    back to a normal rider (we don't have a generic
 *                    "demote to whatever they were" since the source
 *                    role isn't tracked — admin can re-promote to
 *                    driver manually via a different surface if
 *                    needed).
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { supabase } = gate;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  // Always include the current officer list.
  const { data: officers } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("role", "safety_officer")
    .order("created_at", { ascending: false });

  // Search results when a query is supplied.
  let candidates: Array<{ id: string; full_name: string | null; role: string }> = [];
  if (q.length >= 2) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .ilike("full_name", `%${q}%`)
      .limit(20);
    candidates = (data ?? []) as typeof candidates;
  }

  // Hydrate emails from auth.users for the officer list (the admin
  // recognises people by email more than UUID). One getUserById per
  // officer — small list, fine to do sequentially.
  const officerIds = (officers ?? []).map((o) => o.id as string);
  const emailMap = new Map<string, string | null>();
  await Promise.all(
    officerIds.map(async (uid) => {
      const { data } = await supabase.auth.admin.getUserById(uid);
      emailMap.set(uid, data.user?.email ?? null);
    }),
  );

  return NextResponse.json({
    officers: (officers ?? []).map((o) => ({
      id: o.id as string,
      name: (o.full_name as string | null) ?? "Unnamed",
      email: emailMap.get(o.id as string) ?? null,
      promotedAt: o.created_at as string,
    })),
    candidates: candidates.map((c) => ({
      id: c.id,
      name: c.full_name ?? "Unnamed",
      role: c.role,
    })),
  });
}

type PostBody = {
  userId?: string;
  role?: "safety_officer" | "rider";
};

export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { supabase, actor } = gate;

  const body = (await request.json().catch(() => ({}))) as PostBody;
  if (!body.userId || (body.role !== "safety_officer" && body.role !== "rider")) {
    return NextResponse.json(
      { error: "userId and role ('safety_officer' | 'rider') required" },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", body.userId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  if (profile.role === "admin") {
    return NextResponse.json(
      { error: "cannot change admin role from this surface" },
      { status: 400 },
    );
  }
  if (profile.role === "driver" && body.role === "safety_officer") {
    return NextResponse.json(
      {
        error:
          "driver accounts cannot be promoted to safety officer — they need a non-driving account",
      },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: body.role })
    .eq("id", body.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction(supabase, actor, {
    targetType: "admin",
    targetId: body.userId,
    targetLabel: (profile.full_name as string | null) ?? body.userId,
    action:
      body.role === "safety_officer" ? "promote_safety_officer" : "demote_safety_officer",
    summary:
      body.role === "safety_officer"
        ? `Promoted ${profile.full_name ?? body.userId} to safety officer`
        : `Removed safety officer role from ${profile.full_name ?? body.userId}`,
    metadata: {
      previous_role: profile.role,
      new_role: body.role,
    },
  });

  return NextResponse.json({ ok: true });
}
