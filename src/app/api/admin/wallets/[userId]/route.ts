import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getWalletBalance } from "@/lib/wallet";

/**
 * GET /api/admin/wallets/[userId]
 *
 * Full wallet detail for one user — used by the admin's per-user
 * wallet page. Returns:
 *   - profile + email
 *   - current balance
 *   - last 50 transactions
 *   - last 20 deposits, withdrawals, transfers (each side)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { supabase } = gate;

  const [
    profileRes,
    txnsRes,
    depositsRes,
    withdrawalsRes,
    transfersOutRes,
    transfersInRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone, role")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("wallet_transactions")
      .select(
        "id, direction, amount_jmd, kind, ride_id, related_user_id, description, balance_after_jmd, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("wallet_deposits")
      .select("id, amount_jmd, gateway, status, created_at, completed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("wallet_withdrawals")
      .select(
        "id, amount_jmd, bank_name, account_holder_name, status, admin_note, reviewed_at, paid_at, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("wallet_transfers")
      .select(
        "id, recipient_id, amount_jmd, status, created_at, completed_at, message",
      )
      .eq("sender_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("wallet_transfers")
      .select(
        "id, sender_id, amount_jmd, status, created_at, completed_at, message",
      )
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!profileRes.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let email: string | null = null;
  try {
    const { data: authData } = await supabase.auth.admin.getUserById(userId);
    email = authData?.user?.email ?? null;
  } catch (e) {
    console.error("getUserById in /admin/wallets/[id]:", e);
  }

  const balance = await getWalletBalance(supabase, userId);

  return NextResponse.json({
    profile: {
      id: profileRes.data.id,
      fullName:
        (profileRes.data as { full_name: string | null }).full_name ??
        "Unnamed user",
      phone: (profileRes.data as { phone: string | null }).phone,
      role: (profileRes.data as { role: string }).role,
      email,
    },
    balanceJmd: balance,
    transactions: txnsRes.data ?? [],
    deposits: depositsRes.data ?? [],
    withdrawals: withdrawalsRes.data ?? [],
    transfersSent: transfersOutRes.data ?? [],
    transfersReceived: transfersInRes.data ?? [],
  });
}
