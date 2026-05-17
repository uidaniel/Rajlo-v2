import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * POST /api/device/fingerprint
 *
 * Records the calling user's device fingerprint (computed client-side
 * by lib/device-fingerprint.ts). The IP is captured server-side from
 * the proxy headers — never trusted from the client.
 *
 * Stored via the service-role client because `device_fingerprints` is
 * internal fraud data with no public RLS policy. De-duplicated to one
 * row per (user, fingerprint) per 24h so a busy session doesn't flood
 * the table.
 */

type Body = {
  deviceId?: unknown;
  fingerprintHash?: unknown;
  deviceType?: unknown;
  osVersion?: unknown;
  appVersion?: unknown;
};

function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

const str = (v: unknown, max = 256): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export async function POST(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const fingerprintHash = str(body.fingerprintHash, 128);
  if (!fingerprintHash) {
    return NextResponse.json(
      { error: "fingerprintHash is required" },
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

  // De-dupe: skip if this exact (user, fingerprint) was already seen
  // in the last 24 hours.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { count } = await supabase
    .from("device_fingerprints")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("fingerprint_hash", fingerprintHash)
    .gte("created_at", dayAgo);

  if (count && count > 0) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  await supabase.from("device_fingerprints").insert({
    user_id: user.id,
    device_id: str(body.deviceId, 64),
    device_type: str(body.deviceType, 32),
    os_version: str(body.osVersion, 64),
    app_version: str(body.appVersion, 32),
    ip_address: clientIp(request),
    fingerprint_hash: fingerprintHash,
  });

  return NextResponse.json({ ok: true });
}
