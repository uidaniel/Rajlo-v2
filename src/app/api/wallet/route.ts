import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getWalletBalance } from "@/lib/wallet";

/**
 * GET /api/wallet
 *
 * Returns the calling user's wallet — balance plus their most
 * recent transactions. Used by both the rider and driver wallet
 * pages — wallet shape is identical, only the kinds of transactions
 * differ.
 *
 * `?limit=` controls how many transactions come back (default 30).
 */

export async function GET(request: NextRequest) {
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

  const limit = Math.min(
    100,
    Math.max(5, parseInt(request.nextUrl.searchParams.get("limit") ?? "30", 10) || 30),
  );

  const balance = await getWalletBalance(supabase, user.id);

  const { data: txns } = await supabase
    .from("wallet_transactions")
    .select(
      "id, direction, amount_jmd, kind, ride_id, related_user_id, deposit_id, withdrawal_id, transfer_id, description, balance_after_jmd, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return NextResponse.json({
    balanceJmd: balance,
    transactions: txns ?? [],
  });
}
