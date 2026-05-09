import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { calculateRouteFare } from "@/lib/fare-engine";

/**
 * POST /api/admin/routes/import
 *
 * Bulk-import routes from a CSV body. Idempotent: matches existing rows
 * by slug (origin + destination) and updates them in place; new rows
 * insert. Returns per-row outcomes so the admin sees exactly what
 * landed and what failed.
 *
 * CSV columns (header row required, case-insensitive):
 *   origin, destination, parish, distance_km, ta_fare_jmd
 *
 * `ta_fare_jmd` is optional — when blank or missing the formula fills
 * it in from `distance_km`. Comments (#) and blank lines are skipped.
 *
 * Body shape:
 *   { csv: string }
 */

type ImportBody = { csv?: unknown };

type RowOutcome = {
  line: number;
  origin?: string;
  destination?: string;
  outcome: "added" | "updated" | "skipped" | "failed";
  reason?: string;
};

const MAX_CSV_BYTES = 256 * 1024;
const MAX_ROWS = 2000;

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { supabase, actor } = gate;

  const body = (await request.json().catch(() => ({}))) as ImportBody;
  if (typeof body.csv !== "string" || body.csv.trim().length === 0) {
    return NextResponse.json(
      { error: "csv is required (string body)" },
      { status: 400 },
    );
  }
  if (body.csv.length > MAX_CSV_BYTES) {
    return NextResponse.json(
      {
        error: `CSV too large (${body.csv.length} bytes; max ${MAX_CSV_BYTES}).`,
      },
      { status: 413 },
    );
  }

  const lines = body.csv.split(/\r?\n/);
  if (lines.length === 0) {
    return NextResponse.json(
      { error: "CSV is empty" },
      { status: 400 },
    );
  }

  // Header: first non-comment, non-blank line.
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith("#")) continue;
    headerIdx = i;
    break;
  }
  if (headerIdx === -1) {
    return NextResponse.json(
      { error: "No header row found in CSV." },
      { status: 400 },
    );
  }

  const header = parseCsvLine(lines[headerIdx]).map((h) => h.trim().toLowerCase());
  const colOrigin = header.indexOf("origin");
  const colDest = header.indexOf("destination");
  const colParish = header.indexOf("parish");
  const colDistance = header.indexOf("distance_km");
  const colFare = header.indexOf("ta_fare_jmd");

  if (colOrigin === -1 || colDest === -1 || colDistance === -1) {
    return NextResponse.json(
      {
        error:
          "Header must contain at least: origin, destination, distance_km (parish + ta_fare_jmd optional)",
      },
      { status: 400 },
    );
  }

  const outcomes: RowOutcome[] = [];
  const dataRows = lines.slice(headerIdx + 1);
  let processed = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const raw = dataRows[i];
    const lineNumber = headerIdx + 2 + i; // 1-indexed for the admin
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;

    if (++processed > MAX_ROWS) {
      outcomes.push({
        line: lineNumber,
        outcome: "skipped",
        reason: `row cap of ${MAX_ROWS} reached`,
      });
      continue;
    }

    const cells = parseCsvLine(raw);
    const origin = (cells[colOrigin] ?? "").trim();
    const destination = (cells[colDest] ?? "").trim();
    const parish =
      colParish !== -1 ? (cells[colParish] ?? "").trim() || null : null;
    const distanceStr = (cells[colDistance] ?? "").trim();
    const fareStr = colFare !== -1 ? (cells[colFare] ?? "").trim() : "";

    if (!origin || !destination) {
      outcomes.push({
        line: lineNumber,
        origin,
        destination,
        outcome: "failed",
        reason: "origin and destination are required",
      });
      continue;
    }
    if (origin.toLowerCase() === destination.toLowerCase()) {
      outcomes.push({
        line: lineNumber,
        origin,
        destination,
        outcome: "failed",
        reason: "origin and destination must differ",
      });
      continue;
    }

    const distanceKm = Number(distanceStr);
    if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 250) {
      outcomes.push({
        line: lineNumber,
        origin,
        destination,
        outcome: "failed",
        reason: `invalid distance "${distanceStr}" (must be 0–250 km)`,
      });
      continue;
    }

    const formulaFare = calculateRouteFare(distanceKm);
    let taFareJmd = formulaFare;
    if (fareStr) {
      const f = Number(fareStr.replace(/[^\d.]/g, ""));
      if (!Number.isFinite(f) || f <= 0) {
        outcomes.push({
          line: lineNumber,
          origin,
          destination,
          outcome: "failed",
          reason: `invalid TA fare "${fareStr}"`,
        });
        continue;
      }
      taFareJmd = Math.round(f);
    }

    const slug = makeSlug(`${origin}-to-${destination}`);

    // Upsert by slug — same key the seed script uses, so re-importing
    // the same CSV is a no-op.
    const { data: upserted, error } = await supabase
      .from("routes")
      .upsert(
        {
          origin_name: origin,
          destination_name: destination,
          origin_parish: parish,
          destination_parish: parish,
          distance_km: distanceKm,
          ta_fare_jmd: taFareJmd,
          slug,
          active: true,
        },
        { onConflict: "slug" },
      )
      .select("id, created_at, updated_at")
      .single();

    if (error || !upserted) {
      outcomes.push({
        line: lineNumber,
        origin,
        destination,
        outcome: "failed",
        reason: error?.message ?? "upsert failed",
      });
      continue;
    }

    // "Added" if created_at and updated_at are within 1 second; "updated" otherwise.
    // Approximate but good enough — Postgres sets both to now() on insert.
    const createdAt = new Date(upserted.created_at).getTime();
    const updatedAt = new Date(upserted.updated_at).getTime();
    const isNew = Math.abs(updatedAt - createdAt) < 1000;
    outcomes.push({
      line: lineNumber,
      origin,
      destination,
      outcome: isNew ? "added" : "updated",
    });
  }

  const summary = {
    added: outcomes.filter((o) => o.outcome === "added").length,
    updated: outcomes.filter((o) => o.outcome === "updated").length,
    failed: outcomes.filter((o) => o.outcome === "failed").length,
    skipped: outcomes.filter((o) => o.outcome === "skipped").length,
  };

  void logAdminAction(supabase, actor, {
    targetType: "system",
    targetLabel: "routes catalogue",
    action: "route.import",
    summary: `CSV import: ${summary.added} added, ${summary.updated} updated, ${summary.failed} failed`,
    metadata: { summary },
  });

  return NextResponse.json({ ok: true, summary, outcomes });
}

/**
 * Minimal CSV line parser. Handles quoted fields with embedded commas
 * and escaped double-quotes ("") — enough to parse what Excel / Sheets
 * produce. Doesn't handle multi-line quoted fields (rare for our
 * route data).
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === ",") {
      out.push(current);
      current = "";
    } else if (ch === '"' && current === "") {
      inQuotes = true;
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function makeSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
