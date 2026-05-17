import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * POST /api/incidents — a rider or driver files an incident report
 * GET  /api/incidents — list the incidents the caller has filed
 *
 * Incidents are written with the service-role client (the `incidents`
 * RLS policy only grants the reporter SELECT, not INSERT). Reading
 * back uses the caller's own client so RLS scopes it to their reports.
 *
 * Critical-category reports are auto-escalated so the safety team sees
 * them at the top of the queue immediately.
 */

/** Incident categories whose reports jump straight to "escalated". */
const CRITICAL_TYPES = new Set([
  "accident",
  "assault",
  "threats",
  "criminal_activity",
  "harassment",
]);

type Body = {
  incidentType?: unknown;
  severity?: unknown;
  title?: unknown;
  description?: unknown;
  tripId?: unknown;
  incidentTimestamp?: unknown;
};

export async function GET() {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data } = await auth
    .from("incidents")
    .select(
      "id, incident_type, severity_level, status, title, description, reported_at, resolved_at, resolution_summary",
    )
    .eq("reporter_user_id", user.id)
    .order("reported_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ incidents: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await auth
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role ?? "rider";

  const body = (await request.json().catch(() => ({}))) as Body;
  const incidentType =
    typeof body.incidentType === "string" ? body.incidentType.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const tripId =
    typeof body.tripId === "string" && body.tripId.trim()
      ? body.tripId.trim()
      : null;
  const severity =
    typeof body.severity === "string" &&
    ["low", "medium", "high", "critical"].includes(body.severity)
      ? body.severity
      : "medium";

  if (!incidentType || !title || description.length < 10) {
    return NextResponse.json(
      {
        error:
          "incidentType, title, and a description of at least 10 characters are required.",
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "service_role_missing" },
      { status: 500 },
    );
  }

  const isCritical = CRITICAL_TYPES.has(incidentType);
  const effectiveSeverity = isCritical ? "critical" : severity;

  const { data: incident, error } = await supabase
    .from("incidents")
    .insert({
      incident_type: incidentType,
      severity_level: effectiveSeverity,
      // Critical categories skip the queue and land escalated.
      status: isCritical ? "escalated" : "open",
      reporter_user_id: user.id,
      reporter_role: role,
      rider_id: role === "rider" ? user.id : null,
      driver_id: role === "driver" ? user.id : null,
      trip_id: tripId,
      title,
      description,
      context: {
        userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
        reportedVia: "in_app",
      },
      incident_timestamp:
        typeof body.incidentTimestamp === "string"
          ? body.incidentTimestamp
          : null,
    })
    .select("id")
    .single();

  if (error || !incident) {
    return NextResponse.json(
      { error: error?.message ?? "Couldn't file the report." },
      { status: 500 },
    );
  }

  await supabase.from("incident_audit_logs").insert({
    incident_id: incident.id,
    action_type: "incident_created",
    action_description: `${role} filed a ${effectiveSeverity} ${incidentType} report`,
  });

  return NextResponse.json({ ok: true, incidentId: incident.id });
}
