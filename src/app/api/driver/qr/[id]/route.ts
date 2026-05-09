import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET    /api/driver/qr/[id]   — driver polls for status updates
 * DELETE /api/driver/qr/[id]   — driver cancels a still-pending charge
 *
 * The driver's UI polls this every couple seconds while the QR is on
 * screen so the "Paid" confirmation lands the moment the rider taps
 * confirm — no waiting for a notification.
 */

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const { data: charge } = await supabase
    .from("qr_charges")
    .select(
      "id, code, amount_jmd, description, status, expires_at, confirmed_at, cancelled_at, commission_jmd, driver_earnings_jmd, rider_user_id",
    )
    .eq("id", id)
    .eq("driver_user_id", user.id)
    .maybeSingle();

  if (!charge) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Lazy expiry — flip pending charges past their TTL.
  let status = charge.status as string;
  if (status === "pending" && new Date(charge.expires_at) < new Date()) {
    await supabase
      .from("qr_charges")
      .update({ status: "expired" })
      .eq("id", charge.id)
      .eq("status", "pending");
    status = "expired";
  }

  // If a rider confirmed, surface their display name (not the user id).
  let payerName: string | null = null;
  if (charge.rider_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", charge.rider_user_id)
      .maybeSingle();
    payerName = (profile as { full_name?: string } | null)?.full_name ?? null;
  }

  return NextResponse.json({
    charge: {
      id: charge.id,
      code: charge.code,
      amountJmd: charge.amount_jmd,
      description: charge.description,
      status,
      expiresAt: charge.expires_at,
      confirmedAt: charge.confirmed_at,
      cancelledAt: charge.cancelled_at,
      commissionJmd: charge.commission_jmd,
      driverEarningsJmd: charge.driver_earnings_jmd,
      payerName,
    },
  });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const { error } = await supabase
    .from("qr_charges")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("driver_user_id", user.id)
    .eq("status", "pending"); // can't cancel after rider already confirmed

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
