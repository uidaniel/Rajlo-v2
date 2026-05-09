import { NextResponse } from "next/server";
import { logAdminAction, requireAdmin } from "@/lib/admin-auth";
import { creditWallet } from "@/lib/wallet";

/**
 * POST /api/admin/wallet-withdrawals/[id]
 *
 * Admin acts on a withdrawal request. Body:
 *
 *   { decision: "processing" | "paid" | "rejected", note?: string }
 *
 *   - "processing": admin acknowledged the request and started the
 *     bank transfer. Sets status + reviewed timestamps. Money stays
 *     debited from the wallet.
 *
 *   - "paid": bank transfer confirmed. Sets paid_at. Money stays
 *     debited (it actually left the platform).
 *
 *   - "rejected": admin won't pay this out. Refunds the held amount
 *     via a `withdrawal_refund` credit and writes the reason in the
 *     admin_note so the driver sees it on their wallet page.
 */

type Body = { decision?: unknown; note?: unknown };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { actor, supabase } = gate;

  const body = (await request.json().catch(() => ({}))) as Body;
  const decision = body.decision;
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

  if (
    decision !== "processing" &&
    decision !== "paid" &&
    decision !== "rejected"
  ) {
    return NextResponse.json(
      { error: 'decision must be "processing", "paid", or "rejected".' },
      { status: 400 },
    );
  }

  const { data: withdrawal } = await supabase
    .from("wallet_withdrawals")
    .select(
      "id, user_id, amount_jmd, status, bank_name, account_holder_name",
    )
    .eq("id", id)
    .maybeSingle();
  if (!withdrawal) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }
  if (withdrawal.status === "paid" || withdrawal.status === "rejected") {
    return NextResponse.json(
      { error: `Withdrawal already ${withdrawal.status}.` },
      { status: 409 },
    );
  }

  const updates: Record<string, unknown> = {
    status: decision,
    admin_note: note || null,
    reviewed_by: actor.userId,
    reviewed_at: new Date().toISOString(),
  };
  if (decision === "paid") {
    updates.paid_at = new Date().toISOString();
  }

  await supabase.from("wallet_withdrawals").update(updates).eq("id", id);

  if (decision === "rejected") {
    // Refund — money was held at request time so we have to release it.
    const refund = await creditWallet(
      supabase,
      withdrawal.user_id,
      withdrawal.amount_jmd,
      "withdrawal_refund",
      {
        withdrawalId: withdrawal.id,
        description: note
          ? `Withdrawal rejected: ${note}`
          : "Withdrawal rejected by admin",
      },
    );
    if (!refund.ok) {
      // Bad state — re-open so the admin sees it didn't refund.
      await supabase
        .from("wallet_withdrawals")
        .update({ status: "pending" })
        .eq("id", id);
      return NextResponse.json({ error: refund.error }, { status: 500 });
    }
  }

  // Look up the driver display name for the audit log.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", withdrawal.user_id)
    .maybeSingle();

  await logAdminAction(supabase, actor, {
    targetType: "driver",
    targetId: withdrawal.user_id,
    targetLabel:
      ((profile?.full_name as string | null) ?? null) ?? "Unnamed driver",
    action: `withdrawal_${decision}`,
    summary: `${actor.label} marked ${withdrawal.amount_jmd.toLocaleString("en-JM")} JMD withdrawal as ${decision}${note ? ` — ${note}` : ""}`,
    metadata: {
      withdrawalId: withdrawal.id,
      amountJmd: withdrawal.amount_jmd,
      bank: withdrawal.bank_name,
      decision,
      note: note || undefined,
    },
  });

  return NextResponse.json({ ok: true, status: decision });
}
