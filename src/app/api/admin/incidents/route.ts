import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";

/**
 * GET /api/admin/incidents — the incident queue.
 *
 * Gated by `view_incidents` (every moderation tier holds it). Returns
 * incidents ordered with the unresolved + most severe first so the
 * safety team works the right ones first.
 */

type ProfileRow = { id: string; full_name: string | null };

const OPEN_STATUSES = [
  "open",
  "under_review",
  "awaiting_response",
  "escalated",
];

export async function GET(request: Request) {
  const gate = await requirePermission("view_incidents");
  if (gate.error) return gate.error;
  const { supabase } = gate;

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope"); // "open" | "all"

  let q = supabase
    .from("incidents")
    .select(
      "id, incident_type, severity_level, status, title, reporter_user_id, reporter_role, reported_at",
    )
    .order("reported_at", { ascending: false })
    .limit(80);
  if (scope !== "all") {
    q = q.in("status", OPEN_STATUSES);
  }
  const { data: incidents } = await q;

  // Resolve reporter names.
  const ids = [
    ...new Set(
      (incidents ?? [])
        .map((i) => i.reporter_user_id as string | null)
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  const nameById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: names } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    for (const p of (names ?? []) as ProfileRow[]) {
      nameById.set(p.id, p.full_name ?? "Unnamed user");
    }
  }

  return NextResponse.json({
    incidents: (incidents ?? []).map((i) => ({
      id: i.id,
      incidentType: i.incident_type,
      severity: i.severity_level,
      status: i.status,
      title: i.title,
      reporter: i.reporter_user_id
        ? (nameById.get(i.reporter_user_id as string) ?? "Unknown")
        : "Unknown",
      reporterRole: i.reporter_role,
      reportedAt: i.reported_at,
    })),
  });
}
