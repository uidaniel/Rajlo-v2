import { NextResponse } from "next/server";
import { requirePermission, logAdminAction } from "@/lib/admin-auth";
import { recalculateRiskScore } from "@/lib/risk-scoring";

/**
 * GET  /api/admin/fraud/[userId]  — full fraud profile for one user
 * POST /api/admin/fraud/[userId]  — a fraud action against the user
 *
 * GET is gated by `view_fraud`; POST (which mutates) by `manage_fraud`.
 *
 * POST body: { action, ... }
 *   recalculate            — recompute + store the risk score
 *   raise_flag             — { flagType, severity, description }
 *   resolve_flag           — { flagId }
 *   open_investigation     — { summary }
 *   resolve_investigation  — { investigationId, status, resolution }
 */

type ProfileRow = { id: string; full_name: string | null; role: string };

async function loadProfile(
  supabase: Awaited<ReturnType<typeof requirePermission>>["supabase"],
  userId: string,
): Promise<ProfileRow | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const gate = await requirePermission("view_fraud");
  if (gate.error) return gate.error;
  const { supabase } = gate;
  const { userId } = await params;

  const profile = await loadProfile(supabase, userId);
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [{ data: score }, { data: flags }, { data: fingerprints }, { data: investigations }] =
    await Promise.all([
      supabase
        .from("fraud_risk_scores")
        .select("risk_score, risk_level, signals, last_calculated_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("fraud_flags")
        .select(
          "id, flag_type, severity, description, created_at, resolved_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("device_fingerprints")
        .select("fingerprint_hash, ip_address, device_type, os_version, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("fraud_investigations")
        .select("id, status, summary, resolution, created_at, resolved_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

  // Linked accounts — other users sharing any of this user's device
  // fingerprints or IPs.
  const hashes = [
    ...new Set((fingerprints ?? []).map((f) => f.fingerprint_hash as string)),
  ];
  const ips = [
    ...new Set(
      (fingerprints ?? [])
        .map((f) => f.ip_address as string | null)
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  const linkedIds = new Set<string>();
  if (hashes.length > 0) {
    const { data } = await supabase
      .from("device_fingerprints")
      .select("user_id")
      .in("fingerprint_hash", hashes)
      .neq("user_id", userId);
    for (const r of data ?? []) linkedIds.add(r.user_id as string);
  }
  if (ips.length > 0) {
    const { data } = await supabase
      .from("device_fingerprints")
      .select("user_id")
      .in("ip_address", ips)
      .neq("user_id", userId);
    for (const r of data ?? []) linkedIds.add(r.user_id as string);
  }
  const linkedAccounts: { userId: string; name: string }[] = [];
  if (linkedIds.size > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...linkedIds]);
    for (const p of (data ?? []) as ProfileRow[]) {
      linkedAccounts.push({ userId: p.id, name: p.full_name ?? "Unnamed user" });
    }
  }

  return NextResponse.json({
    user: { id: profile.id, name: profile.full_name ?? "Unnamed user", role: profile.role },
    riskScore: score
      ? {
          score: score.risk_score,
          level: score.risk_level,
          breakdown: score.signals ?? {},
          lastCalculatedAt: score.last_calculated_at,
        }
      : null,
    flags: flags ?? [],
    fingerprints: fingerprints ?? [],
    linkedAccounts,
    investigations: investigations ?? [],
  });
}

type PostBody = {
  action?: unknown;
  flagType?: unknown;
  severity?: unknown;
  description?: unknown;
  flagId?: unknown;
  summary?: unknown;
  investigationId?: unknown;
  status?: unknown;
  resolution?: unknown;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const gate = await requirePermission("manage_fraud");
  if (gate.error) return gate.error;
  const { actor, supabase } = gate;
  const { userId } = await params;

  const profile = await loadProfile(supabase, userId);
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const targetLabel = profile.full_name ?? "Unnamed user";

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "recalculate") {
    const result = await recalculateRiskScore(supabase, userId, profile.role);
    return NextResponse.json({ ok: true, riskScore: result });
  }

  if (action === "raise_flag") {
    const flagType = typeof body.flagType === "string" ? body.flagType.trim() : "";
    const severity =
      typeof body.severity === "string" &&
      ["low", "medium", "high", "critical"].includes(body.severity)
        ? body.severity
        : "medium";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    if (!flagType || !description) {
      return NextResponse.json(
        { error: "flagType and description are required." },
        { status: 400 },
      );
    }
    await supabase.from("fraud_flags").insert({
      user_id: userId,
      flag_type: flagType,
      severity,
      description,
      metadata: { raisedBy: "admin", adminId: actor.userId },
    });
    await logAdminAction(supabase, actor, {
      targetType: profile.role === "driver" ? "driver" : "rider",
      targetId: userId,
      targetLabel,
      action: "fraud_flag_raised",
      summary: `${actor.label} raised a ${severity} fraud flag (${flagType}) on ${targetLabel}`,
    });
    await recalculateRiskScore(supabase, userId, profile.role);
    return NextResponse.json({ ok: true });
  }

  if (action === "resolve_flag") {
    const flagId = typeof body.flagId === "string" ? body.flagId : "";
    if (!flagId) {
      return NextResponse.json({ error: "flagId is required." }, { status: 400 });
    }
    await supabase
      .from("fraud_flags")
      .update({ resolved_at: new Date().toISOString(), resolved_by: actor.userId })
      .eq("id", flagId)
      .eq("user_id", userId);
    await recalculateRiskScore(supabase, userId, profile.role);
    return NextResponse.json({ ok: true });
  }

  if (action === "open_investigation") {
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    if (!summary) {
      return NextResponse.json(
        { error: "summary is required." },
        { status: 400 },
      );
    }
    await supabase.from("fraud_investigations").insert({
      user_id: userId,
      status: "open",
      opened_by: actor.userId,
      assigned_admin_id: actor.userId,
      summary,
    });
    await logAdminAction(supabase, actor, {
      targetType: profile.role === "driver" ? "driver" : "rider",
      targetId: userId,
      targetLabel,
      action: "fraud_investigation_opened",
      summary: `${actor.label} opened a fraud investigation on ${targetLabel}`,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "resolve_investigation") {
    const investigationId =
      typeof body.investigationId === "string" ? body.investigationId : "";
    const status =
      typeof body.status === "string" &&
      ["in_review", "resolved", "dismissed"].includes(body.status)
        ? body.status
        : "resolved";
    const resolution =
      typeof body.resolution === "string" ? body.resolution.trim() : null;
    if (!investigationId) {
      return NextResponse.json(
        { error: "investigationId is required." },
        { status: 400 },
      );
    }
    const isClosed = status === "resolved" || status === "dismissed";
    await supabase
      .from("fraud_investigations")
      .update({
        status,
        resolution,
        resolved_at: isClosed ? new Date().toISOString() : null,
      })
      .eq("id", investigationId)
      .eq("user_id", userId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
