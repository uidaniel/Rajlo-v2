import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { calculateRouteFare } from "@/lib/fare-engine";

/**
 * PATCH /api/admin/routes/[id]
 *
 * Edit a route in place. Any subset of editable fields:
 *   { origin, destination, parish, distanceKm, taFareJmd, active }
 *
 * Recomputes the slug + formula fare when origin/destination change so
 * the URL space and reconciliation queries stay consistent. Logs every
 * change to the admin audit trail.
 */

type PatchBody = {
  origin?: string;
  destination?: string;
  parish?: string | null;
  distanceKm?: number;
  taFareJmd?: number;
  active?: boolean;
};

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { supabase, actor } = gate;

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as PatchBody;

  const { data: existing } = await supabase
    .from("routes")
    .select(
      "id, origin_name, destination_name, origin_parish, distance_km, ta_fare_jmd, slug, active",
    )
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  const changes: string[] = [];

  if (typeof body.origin === "string" && body.origin.trim()) {
    const next = body.origin.trim();
    if (next !== existing.origin_name) {
      updates.origin_name = next;
      changes.push(`origin "${existing.origin_name}" → "${next}"`);
    }
  }
  if (typeof body.destination === "string" && body.destination.trim()) {
    const next = body.destination.trim();
    if (next !== existing.destination_name) {
      updates.destination_name = next;
      changes.push(`destination "${existing.destination_name}" → "${next}"`);
    }
  }
  if ("parish" in body) {
    const next = body.parish === null ? null : (body.parish ?? "").trim();
    if (next !== existing.origin_parish) {
      updates.origin_parish = next;
      updates.destination_parish = next;
      changes.push(`parish "${existing.origin_parish}" → "${next}"`);
    }
  }
  if (typeof body.distanceKm === "number") {
    if (!Number.isFinite(body.distanceKm) || body.distanceKm <= 0 || body.distanceKm > 250) {
      return NextResponse.json(
        { error: "Distance must be > 0 and ≤ 250 km." },
        { status: 400 },
      );
    }
    if (Number(existing.distance_km) !== body.distanceKm) {
      updates.distance_km = body.distanceKm;
      changes.push(
        `distance ${existing.distance_km} km → ${body.distanceKm} km (formula JMD $${calculateRouteFare(body.distanceKm)})`,
      );
    }
  }
  if (typeof body.taFareJmd === "number" && body.taFareJmd > 0) {
    const next = Math.round(body.taFareJmd);
    if (next !== existing.ta_fare_jmd) {
      updates.ta_fare_jmd = next;
      changes.push(`TA fare $${existing.ta_fare_jmd} → $${next}`);
    }
  }
  if (typeof body.active === "boolean" && body.active !== existing.active) {
    updates.active = body.active;
    changes.push(body.active ? "reactivated" : "deactivated");
  }

  // If origin or destination moved, recompute the slug. The unique
  // index will reject any collision — same surface as create.
  if (updates.origin_name || updates.destination_name) {
    const newOrigin = (updates.origin_name as string | undefined) ?? existing.origin_name;
    const newDest =
      (updates.destination_name as string | undefined) ?? existing.destination_name;
    updates.slug = makeSlug(`${newOrigin}-to-${newDest}`);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, noChanges: true });
  }

  const { error } = await supabase.from("routes").update(updates).eq("id", id);
  if (error) {
    const isDuplicate = error.code === "23505";
    return NextResponse.json(
      {
        error: isDuplicate
          ? "Another route with that origin/destination already exists."
          : error.message,
      },
      { status: isDuplicate ? 409 : 500 },
    );
  }

  void logAdminAction(supabase, actor, {
    targetType: "system",
    targetId: id,
    targetLabel: `${existing.origin_name} → ${existing.destination_name}`,
    action: "route.update",
    summary: `Edited route: ${changes.join("; ")}`,
  });

  return NextResponse.json({ ok: true });
}

function makeSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
