#!/usr/bin/env node
/**
 * Verify the fare engine against the TA 2023 published worked example
 * AND audit the parsed route seed for parser misalignment (the PDF's
 * multi-column layout occasionally pairs an origin with the wrong
 * row's distance).
 *
 * Usage:
 *   node scripts/verify-fare-engine.mjs
 *
 * Exits non-zero if:
 *   - the worked example diverges
 *   - more than 5% of seeded routes diverge from the formula by more
 *     than $20 (parser likely shifted columns)
 */

import { TA_ROUTES_2023_SEED } from "../src/lib/route-seed.ts";
import {
  ROUTE_TAXI_BASE_RATE_JMD,
  ROUTE_TAXI_RATE_PER_KM_JMD,
  calculateRouteFare,
} from "../src/lib/fare-engine.ts";

let failed = 0;
const note = (...a) => console.log(...a);

// 1. The TA worked example must hold.
{
  const got = calculateRouteFare(15);
  const expected = 220;
  if (got !== expected) {
    console.error(
      `FAIL · TA worked example: 15km should yield $${expected}, got $${got}`,
    );
    failed++;
  } else {
    note(`OK   · TA worked example: 15km → $${got}`);
  }
}

// 2. Constants check.
note(
  `INFO · BASE_RATE=${ROUTE_TAXI_BASE_RATE_JMD}, PER_KM=${ROUTE_TAXI_RATE_PER_KM_JMD}`,
);

// 3. Seed audit. For every parsed row compute calculateRouteFare(distance)
//    and compare with the TA-printed fare. The published table was
//    rounded by humans so a $10 drift is normal; a $20+ drift on more
//    than ~5% of rows means the parser is grabbing wrong numbers.
let audited = 0;
let divergent = 0;
const examples = [];
for (const row of TA_ROUTES_2023_SEED) {
  const formulaFare = calculateRouteFare(row.distanceKm);
  const drift = Math.abs(formulaFare - row.taFareJmd);
  audited++;
  if (drift > 20) {
    divergent++;
    if (examples.length < 12) {
      examples.push(
        `   · ${row.origin} → ${row.destination}: distance=${row.distanceKm}km, formula=$${formulaFare}, TA=$${row.taFareJmd}, drift=$${drift}`,
      );
    }
  }
}

const driftPct = (divergent / audited) * 100;
note(
  `INFO · Seed audit: ${divergent}/${audited} rows drift > $20 from formula (${driftPct.toFixed(1)}%)`,
);
if (examples.length > 0) {
  note("   Sample drifts (first 12):");
  for (const e of examples) note(e);
}
if (driftPct > 5) {
  console.error(
    `FAIL · Drift rate ${driftPct.toFixed(1)}% > 5% — parser is grabbing misaligned columns`,
  );
  failed++;
} else {
  note(`OK   · Drift rate ${driftPct.toFixed(1)}% within tolerance`);
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
