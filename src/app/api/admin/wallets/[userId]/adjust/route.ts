import { NextResponse } from "next/server";
import { logAdminAction, requireAdmin } from "@/lib/admin-auth";
import { creditWallet, debitWallet } from "@/lib/wallet";

/**
 * POST /api/admin/wallets/[userId]/adjust
 *
 * Admin manually credits or debits a user's wallet. Use cases:
 *   - Refund a charged ride that didn't actually happen
 *   - Top up a driver after a manual bank reconciliation
 *   - Clawback after a chargeback / fraud review
 *
 * Every adjustment writes a row to admin_audit_logs with the
 * reason + before/after balances. This is the only way an admin
 * can move money — direct UPDATEs on the wallets table are blocked
 * by RLS even with the service-role key, by convention (we never
 * write directly to balance_jmd anywhere in the codebase).
 *
 * Body: {
 *   direction: "credit" | "debit",
 *   amountJmd: number,
 *   reason: string  // required, shown in user-facing transaction list
 * }
 */

const MAX_ADJUSTMENT = 1_000_000;

type Body = {
  direction?: unknown;
  amountJmd?: unknown;
  reason?: unknown;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { actor, supabase } = gate;

  const body = (await request.json().catch(() => ({}))) as Body;
  const direction =
    body.direction === "credit" || body.direction === "debit"
      ? (body.direction as "credit" | "debit")
      : null;
  const amount = Number(body.amountJmd);
  const reason =
    typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";

  if (!direction) {
    return NextResponse.json(
      { error: 'direction must be "credit" or "debit".' },
      { status: 400 },
    );
  }
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_ADJUSTMENT) {
    return NextResponse.json(
      {
        error: `Amount must be a whole number between 1 and ${MAX_ADJUSTMENT.toLocaleString("en-JM")} JMD.`,
      },
      { status: 400 },
    );
  }
  if (!reason) {
    return NextResponse.json(
      { error: "Reason is required — it shows up on the user's transaction list." },
      { status: 400 },
    );
  }

  // Look up the target so we can label the audit log nicely.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const description = `${reason} (admin: ${actor.label})`;
  const result =
    direction === "credit"
      ? await creditWallet(supabase, userId, amount, "admin_credit", {
          description,
          metadata: { admin_id: actor.userId, reason },
        })
      : await debitWallet(supabase, userId, amount, "admin_debit", {
          description,
          metadata: { admin_id: actor.userId, reason },
        });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.insufficientFunds
          ? `User's balance is too low for that debit.`
          : result.error,
      },
      { status: result.insufficientFunds ? 402 : 500 },
    );
  }

  await logAdminAction(supabase, actor, {
    targetType:
      profile.role === "driver"
        ? "driver"
        : profile.role === "admin"
          ? "admin"
          : "rider",
    targetId: userId,
    targetLabel: (profile.full_name as string | null) ?? "Unnamed user",
    action: direction === "credit" ? "wallet_credit" : "wallet_debit",
    summary: `${actor.label} ${direction === "credit" ? "credited" : "debited"} ${amount.toLocaleString("en-JM")} JMD ${direction === "credit" ? "to" : "from"} ${profile.full_name ?? "user"}'s wallet — ${reason}`,
    metadata: {
      direction,
      amountJmd: amount,
      reason,
      newBalanceJmd: result.balanceAfter,
    },
  });

  return NextResponse.json({
    ok: true,
    balanceAfter: result.balanceAfter,
  });
}
