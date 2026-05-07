import { NextResponse } from "next/server";
import { getDriverStatus } from "@/lib/driver-status";

/**
 * GET /api/driver/status
 *
 * Returns the signed-in user's driver-onboarding state. Used by the
 * onboarding page's client-side gate to redirect already-submitted drivers
 * to /driver/pending without exposing them to RLS pitfalls.
 *
 * Returns just `state` so we don't leak any DB internals to the browser.
 */
export async function GET() {
  const status = await getDriverStatus();
  return NextResponse.json({ state: status.state });
}
