import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { initiateDeposit } from "@/lib/wipay";

/**
 * POST /api/wallet/deposit
 *
 * Starts a deposit. Creates a `wallet_deposits` row in 'pending'
 * state, asks the gateway (WiPay) for a hosted-checkout URL, and
 * returns that URL to the client. The client redirects the user to
 * it; the gateway POSTs back to /api/wallet/deposit/callback when
 * the payment completes (or the user clicks Cancel).
 *
 * Body: { amountJmd: number }
 *   - integer JMD, between 100 and 200_000
 *
 * Response: { ok: true, depositId, redirectUrl } or { error }.
 */

const MIN_DEPOSIT = 100;
const MAX_DEPOSIT = 200_000;

type Body = { amountJmd?: unknown };

export async function POST(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const amount = Number(body.amountJmd);
  if (!Number.isInteger(amount) || amount < MIN_DEPOSIT || amount > MAX_DEPOSIT) {
    return NextResponse.json(
      {
        error: `Amount must be a whole number between ${MIN_DEPOSIT} and ${MAX_DEPOSIT.toLocaleString("en-JM")} JMD.`,
      },
      { status: 400 },
    );
  }

  // Look up display name for the gateway receipt.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const customerName = (profile?.full_name as string | undefined) ?? user.email;

  // Create the pending deposit record FIRST so we have a stable id
  // to pass to the gateway as our internal reference.
  const { data: deposit, error: depositError } = await supabase
    .from("wallet_deposits")
    .insert({
      user_id: user.id,
      amount_jmd: amount,
      gateway: "wipay",
      status: "pending",
    })
    .select("id")
    .single();

  if (depositError || !deposit) {
    return NextResponse.json(
      { error: depositError?.message ?? "Couldn't create deposit." },
      { status: 500 },
    );
  }

  const origin = new URL(request.url).origin;
  const init = await initiateDeposit({
    depositId: deposit.id,
    amountJmd: amount,
    email: user.email,
    customerName,
    origin,
  });

  if (!init.ok) {
    // Mark the deposit failed so it doesn't sit pending forever.
    await supabase
      .from("wallet_deposits")
      .update({ status: "failed", metadata: { initiate_error: init.error } })
      .eq("id", deposit.id);
    return NextResponse.json({ error: init.error }, { status: 502 });
  }

  // Persist the gateway reference + redirect URL so the admin can
  // trace later if anything goes sideways.
  await supabase
    .from("wallet_deposits")
    .update({
      gateway_reference: init.gatewayReference,
      gateway_redirect_url: init.redirectUrl,
    })
    .eq("id", deposit.id);

  return NextResponse.json({
    ok: true,
    depositId: deposit.id,
    redirectUrl: init.redirectUrl,
  });
}
