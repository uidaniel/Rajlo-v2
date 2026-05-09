#!/usr/bin/env node
/**
 * Upsert the parsed TA 2023 route catalogue into Supabase.
 *
 * Run once after applying `supabase/route-taxi-migration.sql`. Idempotent:
 * re-runs update existing rows by slug (so re-parsing the PDF and re-running
 * this script is safe).
 *
 * Required env (read from .env.local automatically when present):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/seed-routes.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { TA_ROUTES_2023_SEED } from "../src/lib/route-seed.ts";

// Load .env.local if present (best-effort — dotenv isn't a dep).
try {
  const envText = readFileSync(resolve(".env.local"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      // Strip surrounding quotes if present.
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* no .env.local — env must be set by caller */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "seed-routes: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH_SIZE = 100;
let upserted = 0;
let failed = 0;

console.log(`seed-routes: upserting ${TA_ROUTES_2023_SEED.length} routes…`);

for (let i = 0; i < TA_ROUTES_2023_SEED.length; i += BATCH_SIZE) {
  const batch = TA_ROUTES_2023_SEED.slice(i, i + BATCH_SIZE).map((r) => ({
    origin_name: r.origin,
    destination_name: r.destination,
    origin_parish: r.parish,
    destination_parish: r.parish,
    distance_km: r.distanceKm,
    ta_fare_jmd: r.taFareJmd,
    slug: r.slug,
    active: true,
  }));

  const { error, count } = await supabase
    .from("routes")
    .upsert(batch, { onConflict: "slug", count: "exact" });

  if (error) {
    failed += batch.length;
    console.error(
      `seed-routes: batch ${i}-${i + batch.length} failed: ${error.message}`,
    );
  } else {
    upserted += count ?? batch.length;
  }
}

console.log(
  `seed-routes: done · upserted=${upserted} failed=${failed} total=${TA_ROUTES_2023_SEED.length}`,
);
process.exit(failed > 0 ? 1 : 0);
