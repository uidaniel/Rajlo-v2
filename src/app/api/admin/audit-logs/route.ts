import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/audit-logs
 *
 * Pageable, filterable audit log feed for the audit-logs page.
 * Combines `admin_audit_logs` and `driver_audit_logs` into one
 * stream so the admin can see every accountable action regardless
 * of which subsystem produced it.
 *
 * Query params:
 *   ?source=admin|driver|all
 *   ?action=<exact-match>     (e.g. 'delete', 'deactivate')
 *   ?targetType=rider|driver|admin|ride|system
 *   ?q=<search>               (matches summary text)
 *   ?days=30                  (default 30, max 365, 0 = all-time)
 *   ?limit=100 (max 500) ?offset=0
 */

export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { supabase } = gate;

  const sp = request.nextUrl.searchParams;
  const source = sp.get("source") ?? "all";
  const action = sp.get("action");
  const targetType = sp.get("targetType");
  const q = (sp.get("q") ?? "").trim();
  const days = Math.max(
    0,
    Math.min(365, parseInt(sp.get("days") ?? "30", 10) || 30),
  );
  const limit = Math.min(
    500,
    Math.max(10, parseInt(sp.get("limit") ?? "100", 10) || 100),
  );
  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);

  const since =
    days > 0
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      : null;

  type Entry = {
    id: string;
    source: "admin" | "driver";
    action: string;
    summary: string;
    actor: string | null;
    targetType: string | null;
    targetId: string | null;
    targetLabel: string | null;
    createdAt: string;
  };
  const entries: Entry[] = [];

  if (source === "admin" || source === "all") {
    let query = supabase
      .from("admin_audit_logs")
      .select(
        "id, action, summary, actor_label, target_type, target_id, target_label, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit + offset);

    if (action) query = query.eq("action", action);
    if (targetType) query = query.eq("target_type", targetType);
    if (since) query = query.gte("created_at", since);
    if (q) query = query.ilike("summary", `%${q}%`);

    const { data } = await query;
    ((data ?? []) as Array<{
      id: string;
      action: string;
      summary: string;
      actor_label: string | null;
      target_type: string;
      target_id: string | null;
      target_label: string | null;
      created_at: string;
    }>).forEach((row) =>
      entries.push({
        id: `admin-${row.id}`,
        source: "admin",
        action: row.action,
        summary: row.summary,
        actor: row.actor_label,
        targetType: row.target_type,
        targetId: row.target_id,
        targetLabel: row.target_label,
        createdAt: row.created_at,
      }),
    );
  }

  if (source === "driver" || source === "all") {
    // driver_audit_logs join → drivers for the external_id label
    let query = supabase
      .from("driver_audit_logs")
      .select("id, driver_id, actor_role, actor_id, event, created_at")
      .order("created_at", { ascending: false })
      .limit(limit + offset);

    if (since) query = query.gte("created_at", since);
    if (q) query = query.ilike("event", `%${q}%`);

    const { data: drvAudits } = await query;
    type DrvAudit = {
      id: string;
      driver_id: string;
      actor_role: string;
      actor_id: string | null;
      event: string;
      created_at: string;
    };
    const audits = (drvAudits ?? []) as DrvAudit[];

    if (audits.length > 0) {
      const driverIds = Array.from(new Set(audits.map((a) => a.driver_id)));
      const { data: driverRows } = await supabase
        .from("drivers")
        .select("id, external_id, first_name, last_name")
        .in("id", driverIds);
      const drvMap = new Map(
        ((driverRows ?? []) as Array<{
          id: string;
          external_id: string;
          first_name: string | null;
          last_name: string | null;
        }>).map((d) => [
          d.id,
          {
            externalId: d.external_id,
            label:
              [d.first_name, d.last_name].filter(Boolean).join(" ") ||
              d.external_id,
          },
        ]),
      );

      audits.forEach((a) => {
        const drv = drvMap.get(a.driver_id);
        if (targetType && targetType !== "driver") return;
        entries.push({
          id: `driver-${a.id}`,
          source: "driver",
          action: a.actor_role,
          summary: a.event,
          actor: a.actor_id,
          targetType: "driver",
          targetId: drv?.externalId ?? a.driver_id,
          targetLabel: drv?.label ?? "Driver",
          createdAt: a.created_at,
        });
      });
    }
  }

  entries.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return NextResponse.json({
    entries: entries.slice(offset, offset + limit),
    total: entries.length,
    limit,
    offset,
  });
}
