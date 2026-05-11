import { NextResponse } from "next/server";
import { requireSafetyOfficerOrAdmin } from "@/lib/admin-auth";
import { SAFETY_TIPS } from "@/lib/safety-tips";

/**
 * Chat thread on a specific safety alert, from the officer / admin
 * side. Riders use the mirror endpoint at
 * /api/rider/safety-alerts/[id]/messages.
 *
 *   GET   — full message history for the alert, oldest-first
 *   POST  — officer or admin posts a message. Body:
 *            { body: string }                     — free message
 *            { tipId: string }                    — pre-canned tip from
 *              the SAFETY_TIPS library; body is filled in server-side
 *              so a tampered client can't claim arbitrary text was a
 *              "tip" for analytics
 *
 * Hydrates each row with author display name + role so the UI doesn't
 * need a second round-trip per message.
 */

export const dynamic = "force-dynamic";

type PostBody = {
  body?: string;
  tipId?: string;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await requireSafetyOfficerOrAdmin();
  if (gate.error) return gate.error;
  const { supabase } = gate;

  const { data: alert } = await supabase
    .from("safety_alerts")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!alert) {
    return NextResponse.json({ error: "alert_not_found" }, { status: 404 });
  }

  const { data: rows, error } = await supabase
    .from("safety_alert_messages")
    .select("id, alert_id, author_id, author_role, body, is_tip, created_at")
    .eq("alert_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const messages = rows ?? [];
  const authorIds = Array.from(new Set(messages.map((m) => m.author_id as string)));
  let nameMap = new Map<string, string | null>();
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);
    nameMap = new Map(
      (profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? null]),
    );
  }

  const hydrated = messages.map((m) => ({
    id: m.id as string,
    alertId: m.alert_id as string,
    authorId: m.author_id as string,
    authorRole: m.author_role as "rider" | "safety_officer" | "admin",
    authorName: nameMap.get(m.author_id as string) ?? null,
    body: m.body as string,
    isTip: Boolean(m.is_tip),
    createdAt: m.created_at as string,
  }));

  return NextResponse.json({ messages: hydrated });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await requireSafetyOfficerOrAdmin();
  if (gate.error) return gate.error;
  const { supabase, actor } = gate;

  const body = (await request.json().catch(() => ({}))) as PostBody;

  let messageBody: string | null = null;
  let isTip = false;
  if (typeof body.tipId === "string" && body.tipId.length > 0) {
    const tip = SAFETY_TIPS.find((t) => t.id === body.tipId);
    if (!tip) {
      return NextResponse.json({ error: "unknown_tip" }, { status: 400 });
    }
    messageBody = tip.body;
    isTip = true;
  } else if (typeof body.body === "string" && body.body.trim().length > 0) {
    messageBody = body.body.trim().slice(0, 2000);
  }

  if (!messageBody) {
    return NextResponse.json(
      { error: "body or tipId required" },
      { status: 400 },
    );
  }

  // Confirm the alert exists; insert under service role.
  const { data: alert } = await supabase
    .from("safety_alerts")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!alert) {
    return NextResponse.json({ error: "alert_not_found" }, { status: 404 });
  }

  const { data: inserted, error } = await supabase
    .from("safety_alert_messages")
    .insert({
      alert_id: id,
      author_id: actor.userId,
      author_role: actor.role,
      body: messageBody,
      is_tip: isTip,
    })
    .select("id, alert_id, author_id, author_role, body, is_tip, created_at")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "insert_failed" },
      { status: 500 },
    );
  }

  // Bump the alert to acknowledged on first officer reply so the queue
  // reflects that someone is on it. Only if currently open.
  if (alert.status === "open") {
    await supabase
      .from("safety_alerts")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: actor.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "open");
  }

  return NextResponse.json({
    message: {
      id: inserted.id as string,
      alertId: inserted.alert_id as string,
      authorId: inserted.author_id as string,
      authorRole: inserted.author_role as "rider" | "safety_officer" | "admin",
      authorName: actor.label,
      body: inserted.body as string,
      isTip: Boolean(inserted.is_tip),
      createdAt: inserted.created_at as string,
    },
  });
}
