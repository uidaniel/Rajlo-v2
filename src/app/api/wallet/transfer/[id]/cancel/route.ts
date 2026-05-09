import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { creditWallet } from "@/lib/wallet";

/**
 * POST /api/wallet/transfer/[id]/cancel
 *
 * Sender bails on a pending transfer before entering the OTP. We
 * mark the transfer cancelled and refund the held amount via a
 * `transfer_in` credit.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const { data: transfer } = await supabase
    .from("wallet_transfers")
    .select("id, sender_id, recipient_id, amount_jmd, status")
    .eq("id", id)
    .maybeSingle();
  if (!transfer || transfer.sender_id !== user.id) {
    return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
  }
  if (transfer.status !== "pending_verification") {
    return NextResponse.json(
      { error: `This transfer is already ${transfer.status}.` },
      { status: 409 },
    );
  }

  await supabase
    .from("wallet_transfers")
    .update({ status: "cancelled" })
    .eq("id", transfer.id);

  const refund = await creditWallet(
    supabase,
    transfer.sender_id,
    transfer.amount_jmd,
    "transfer_in",
    {
      transferId: transfer.id,
      relatedUserId: transfer.recipient_id,
      description: "Refund — transfer cancelled",
    },
  );
  if (!refund.ok) {
    // Re-open so it doesn't sit cancelled-but-not-refunded.
    await supabase
      .from("wallet_transfers")
      .update({ status: "pending_verification" })
      .eq("id", transfer.id);
    return NextResponse.json({ error: refund.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, balanceAfter: refund.balanceAfter });
}
