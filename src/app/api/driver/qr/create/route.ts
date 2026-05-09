import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import {
  generateQrCode,
  qrPayloadFor,
  QR_CHARGE_TTL_MINUTES,
} from "@/lib/qr-code";

/**
 * POST /api/driver/qr/create
 *
 * Driver mints a QR pay charge. Returns the row id, the typeable
 * code, the payload to encode in the QR image, and the expiry. Driver
 * UI then renders the QR (`qrcode` lib client-side) and polls
 * /api/driver/qr/[id] for status.
 *
 * Body:
 *   { amountJmd: integer, description?: string }
 */

const MIN_QR = 50;
const MAX_QR = 200_000;

type CreateBody = {
  amountJmd?: unknown;
  description?: unknown;
};

export async function POST(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CreateBody;
  const amount = Number(body.amountJmd);
  if (!Number.isInteger(amount) || amount < MIN_QR || amount > MAX_QR) {
    return NextResponse.json(
      {
        error: `Amount must be a whole number between ${MIN_QR} and ${MAX_QR.toLocaleString("en-JM")} JMD.`,
      },
      { status: 400 },
    );
  }
  const description =
    typeof body.description === "string"
      ? body.description.trim().slice(0, 200) || null
      : null;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  // Resolve driver row — only activated drivers can charge via QR.
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, activated, onboarding_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!driver) {
    return NextResponse.json(
      { error: "Driver record not found" },
      { status: 404 },
    );
  }
  if (!driver.activated || driver.onboarding_status !== "approved") {
    return NextResponse.json(
      { error: "Driver is not activated; complete TA verification first." },
      { status: 403 },
    );
  }

  const expiresAt = new Date(
    Date.now() + QR_CHARGE_TTL_MINUTES * 60 * 1000,
  ).toISOString();

  // Try a few codes in case of collision (extremely unlikely at 31^8
  // but the unique constraint will reject duplicates and we'd rather
  // retry than error out).
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = generateQrCode();
    const { data: charge, error } = await supabase
      .from("qr_charges")
      .insert({
        driver_id: driver.id,
        driver_user_id: user.id,
        amount_jmd: amount,
        description,
        code,
        status: "pending",
        expires_at: expiresAt,
      })
      .select("id, code, amount_jmd, expires_at, status")
      .single();

    if (error) {
      lastError = error.message;
      // Postgres unique-violation — retry with a new code.
      if (error.code === "23505") continue;
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const origin = new URL(request.url).origin;
    return NextResponse.json({
      ok: true,
      charge: {
        id: charge.id,
        code: charge.code,
        amountJmd: charge.amount_jmd,
        expiresAt: charge.expires_at,
        status: charge.status,
        qrPayload: qrPayloadFor(origin, charge.code),
      },
    });
  }

  return NextResponse.json(
    {
      error: `Couldn't allocate a unique QR code after retries: ${lastError ?? "unknown"}`,
    },
    { status: 500 },
  );
}
