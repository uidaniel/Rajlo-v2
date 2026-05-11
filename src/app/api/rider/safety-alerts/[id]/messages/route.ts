import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * Rider-side chat thread on their own safety alert.
 *
 *   GET   — full message history (rider can only see own alerts)
 *   POST  — rider posts a free message (no tips on the rider side).
 *            { body: string }
 *
 * Ownership is enforced by joining on `safety_alerts.rider_id =
 * auth.uid()` before touching messages. We don't trust the rider to
 * tell us their author_role — it's always `rider`.
 */

export const dynamic = "force-dynamic";

type PostBody = { body?: string };

async function auth() {
  const a = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await a.auth.getUser();
  return user;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await auth();
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

  const { data: alert } = await supabase
    .from("safety_alerts")
    .select("id, rider_id")
    .eq("id", id)
    .maybeSingle();
  if (!alert || alert.rider_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
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
    // Officers/admins show as "Rajlo Safety" to the rider — we don't
    // surface individual officer names to riders. Riders see their
    // own real name so they can recognise their messages in the thread.
    authorName:
      m.author_role === "rider"
        ? (nameMap.get(m.author_id as string) ?? "You")
        : "Rajlo Safety",
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
  const user = await auth();
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

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const text =
    typeof body.body === "string" ? body.body.trim().slice(0, 2000) : "";
  if (!text) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const { data: alert } = await supabase
    .from("safety_alerts")
    .select("id, rider_id")
    .eq("id", id)
    .maybeSingle();
  if (!alert || alert.rider_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: inserted, error } = await supabase
    .from("safety_alert_messages")
    .insert({
      alert_id: id,
      author_id: user.id,
      author_role: "rider",
      body: text,
      is_tip: false,
    })
    .select("id, alert_id, author_id, author_role, body, is_tip, created_at")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "insert_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message: {
      id: inserted.id as string,
      alertId: inserted.alert_id as string,
      authorId: inserted.author_id as string,
      authorRole: "rider" as const,
      authorName: "You",
      body: inserted.body as string,
      isTip: false,
      createdAt: inserted.created_at as string,
    },
  });
}
