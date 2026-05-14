import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET  /api/rider/settings/pin — read the signed-in rider's
 *                                "Verify Your Ride" preference
 * PATCH /api/rider/settings/pin — update it
 *
 * Body shape for PATCH:
 *   { enabled: boolean, mode: "always" | "night_only" }
 *
 * `mode` is optional on PATCH if `enabled === false` (we just leave
 * whatever was there — when the rider re-enables, their last
 * mode choice persists).
 */

type Mode = "always" | "night_only";

function isMode(v: unknown): v is Mode {
  return v === "always" || v === "night_only";
}

export async function GET() {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await auth
    .from("profiles")
    .select("pin_verify_enabled, pin_verify_mode")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    enabled: Boolean(
      (data as { pin_verify_enabled?: boolean } | null)?.pin_verify_enabled,
    ),
    mode:
      ((data as { pin_verify_mode?: string } | null)?.pin_verify_mode as Mode) ??
      "always",
  });
}

export async function PATCH(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    enabled?: unknown;
    mode?: unknown;
  };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "`enabled` must be a boolean" },
      { status: 400 },
    );
  }
  // Mode is optional, but if present it has to be a valid value.
  const next: { pin_verify_enabled: boolean; pin_verify_mode?: Mode } = {
    pin_verify_enabled: body.enabled,
  };
  if (body.mode !== undefined) {
    if (!isMode(body.mode)) {
      return NextResponse.json(
        { error: "`mode` must be 'always' or 'night_only'" },
        { status: 400 },
      );
    }
    next.pin_verify_mode = body.mode;
  }

  const { error } = await auth
    .from("profiles")
    .update(next)
    .eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
