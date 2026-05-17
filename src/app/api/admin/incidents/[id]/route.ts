import { NextResponse } from "next/server";
import { requirePermission, requireAdmin } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/admin-rbac";

/**
 * GET   /api/admin/incidents/[id] — full incident dossier
 * PATCH /api/admin/incidents/[id] — update status / assignment /
 *                                   resolution, or add a support note
 *
 * GET needs `view_incidents`; mutations need `manage_incidents`. Every
 * change writes an `incident_audit_logs` row — the immutable trail.
 *
 * PATCH body (one of):
 *   { status, resolutionSummary?, actionTaken? }  — workflow update
 *   { note, isInternal? }                         — add a support note
 *   { assignToMe: true }                          — self-assign
 */

const VALID_STATUS = [
  "open",
  "under_review",
  "awaiting_response",
  "escalated",
  "resolved",
  "closed",
];

type ProfileRow = { id: string; full_name: string | null };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requirePermission("view_incidents");
  if (gate.error) return gate.error;
  const { supabase } = gate;
  const { id } = await params;

  const { data: incident } = await supabase
    .from("incidents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const [{ data: evidence }, { data: notes }, { data: auditLogs }] =
    await Promise.all([
      supabase
        .from("incident_evidence")
        .select("id, evidence_type, file_url, uploaded_at")
        .eq("incident_id", id)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("support_notes")
        .select("id, admin_label, note_text, is_internal, created_at")
        .eq("incident_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("incident_audit_logs")
        .select("id, action_type, action_description, created_at")
        .eq("incident_id", id)
        .order("created_at", { ascending: false }),
    ]);

  // Reporter name.
  let reporterName = "Unknown";
  if (incident.reporter_user_id) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", incident.reporter_user_id)
      .maybeSingle();
    reporterName = (data as ProfileRow | null)?.full_name ?? "Unnamed user";
  }

  return NextResponse.json({
    incident: {
      id: incident.id,
      incidentType: incident.incident_type,
      severity: incident.severity_level,
      status: incident.status,
      title: incident.title,
      description: incident.description,
      tripId: incident.trip_id,
      reporterName,
      reporterRole: incident.reporter_role,
      reporterUserId: incident.reporter_user_id,
      context: incident.context,
      incidentTimestamp: incident.incident_timestamp,
      reportedAt: incident.reported_at,
      resolvedAt: incident.resolved_at,
      resolutionSummary: incident.resolution_summary,
      actionTaken: incident.action_taken,
    },
    evidence: evidence ?? [],
    notes: notes ?? [],
    auditLogs: auditLogs ?? [],
  });
}

type PatchBody = {
  status?: unknown;
  resolutionSummary?: unknown;
  actionTaken?: unknown;
  note?: unknown;
  isInternal?: unknown;
  assignToMe?: unknown;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // A note can be added by any incident-viewer; workflow changes need
  // manage_incidents. We gate generously then re-check below.
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { actor, supabase } = gate;
  if (!hasPermission(actor.adminRole, "view_incidents")) {
    return NextResponse.json(
      { error: "insufficient_permission" },
      { status: 403 },
    );
  }
  const { id } = await params;
  const canManage = hasPermission(actor.adminRole, "manage_incidents");

  const { data: incident } = await supabase
    .from("incidents")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;

  // ── Add a support note ──
  if (typeof body.note === "string" && body.note.trim()) {
    if (!canManage) {
      return NextResponse.json(
        { error: "insufficient_permission" },
        { status: 403 },
      );
    }
    await supabase.from("support_notes").insert({
      incident_id: id,
      admin_user_id: actor.userId,
      admin_label: actor.label,
      note_text: body.note.trim(),
      is_internal: body.isInternal !== false,
    });
    await supabase.from("incident_audit_logs").insert({
      incident_id: id,
      action_type: "note_added",
      action_description: `${actor.label} added a support note`,
      admin_user_id: actor.userId,
    });
    return NextResponse.json({ ok: true });
  }

  // ── Self-assign ──
  if (body.assignToMe === true) {
    if (!canManage) {
      return NextResponse.json(
        { error: "insufficient_permission" },
        { status: 403 },
      );
    }
    await supabase
      .from("incidents")
      .update({ assigned_admin_id: actor.userId, updated_at: new Date().toISOString() })
      .eq("id", id);
    await supabase.from("incident_audit_logs").insert({
      incident_id: id,
      action_type: "assigned",
      action_description: `${actor.label} took ownership of the incident`,
      admin_user_id: actor.userId,
    });
    return NextResponse.json({ ok: true });
  }

  // ── Workflow / status update ──
  if (typeof body.status === "string") {
    if (!canManage) {
      return NextResponse.json(
        { error: "insufficient_permission" },
        { status: 403 },
      );
    }
    if (!VALID_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const isClosed = body.status === "resolved" || body.status === "closed";
    const update: Record<string, unknown> = {
      status: body.status,
      updated_at: new Date().toISOString(),
    };
    if (typeof body.resolutionSummary === "string") {
      update.resolution_summary = body.resolutionSummary.trim() || null;
    }
    if (typeof body.actionTaken === "string") {
      update.action_taken = body.actionTaken.trim() || null;
    }
    update.resolved_at = isClosed ? new Date().toISOString() : null;

    await supabase.from("incidents").update(update).eq("id", id);
    await supabase.from("incident_audit_logs").insert({
      incident_id: id,
      action_type: "status_changed",
      action_description: `${actor.label} set status to ${body.status}`,
      admin_user_id: actor.userId,
      metadata: { from: incident.status, to: body.status },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}
