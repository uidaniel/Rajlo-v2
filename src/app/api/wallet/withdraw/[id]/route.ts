import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { creditWallet } from "@/lib/wallet";

/**
 * DELETE /api/wallet/withdraw/[id]
 *
 * Driver cancels a still-pending withdrawal. Refunds the debited
 * amount via a 'withdrawal_refund' credit so the ledger stays
 * append-only. Once an admin has marked the withdrawal as
 * `processing` or `paid` the bank transfer is in motion — at that
 * point cancellation has to go through admin support.
 */
export async function DELETE(
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

  const { data: withdrawal } = await supabase
    .from("wallet_withdrawals")
    .select("id, user_id, amount_jmd, status, bank_name")
    .eq("id", id)
    .maybeSingle();
  if (!withdrawal || withdrawal.user_id !== user.id) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }
  if (withdrawal.status !== "pending") {
    return NextResponse.json(
      {
        error:
          "This withdrawal is already being processed — contact support to cancel.",
      },
      { status: 409 },
    );
  }

  await supabase
    .from("wallet_withdrawals")
    .update({ status: "cancelled" })
    .eq("id", withdrawal.id);

  const refund = await creditWallet(
    supabase,
    user.id,
    withdrawal.amount_jmd,
    "withdrawal_refund",
    {
      withdrawalId: withdrawal.id,
      description: `Cancelled withdrawal to ${withdrawal.bank_name ?? "bank"}`,
    },
  );

  if (!refund.ok) {
    // Re-open the withdrawal so the admin sees it didn't refund cleanly.
    await supabase
      .from("wallet_withdrawals")
      .update({ status: "pending" })
      .eq("id", withdrawal.id);
    return NextResponse.json({ error: refund.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, balanceAfter: refund.balanceAfter });
}
