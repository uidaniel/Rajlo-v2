import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side wallet helpers. Every wallet mutation in the app routes
 * through one of these so:
 *
 *   - The DB trigger (`apply_wallet_transaction`) maintains the
 *     balance cache and enforces the non-negative invariant.
 *   - Insufficient-balance errors come back as a typed result rather
 *     than a raw Postgres exception the caller has to parse.
 *   - We never accidentally write to `wallets.balance_jmd` directly
 *     and let the cache drift from the ledger.
 *
 * Caller MUST pass a service-role Supabase client (RLS blocks all
 * client-side writes by design).
 */

export type WalletKind =
  | "deposit"
  | "ride_charge"
  | "ride_earning"
  | "withdrawal"
  | "withdrawal_refund"
  | "transfer_out"
  | "transfer_in"
  | "admin_credit"
  | "admin_debit"
  | "refund";

type RecordOptions = {
  rideId?: string | null;
  relatedUserId?: string | null;
  depositId?: string | null;
  withdrawalId?: string | null;
  transferId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

type Outcome =
  | { ok: true; balanceAfter: number; transactionId: string }
  | { ok: false; error: string; insufficientFunds?: boolean };

/**
 * Credit a user's wallet — adds money. Returns the new balance on
 * success. Used for deposits, ride earnings, transfer-in, refunds,
 * admin top-ups.
 */
export async function creditWallet(
  supabase: SupabaseClient,
  userId: string,
  amountJmd: number,
  kind: WalletKind,
  options: RecordOptions = {},
): Promise<Outcome> {
  return recordTransaction(supabase, userId, "credit", amountJmd, kind, options);
}

/**
 * Debit a user's wallet — subtracts money. Returns
 * `{ ok: false, insufficientFunds: true }` if the balance would go
 * negative — caller decides how to surface that to the user.
 *
 * Used for ride charges, withdrawals, transfer-out, admin debits.
 */
export async function debitWallet(
  supabase: SupabaseClient,
  userId: string,
  amountJmd: number,
  kind: WalletKind,
  options: RecordOptions = {},
): Promise<Outcome> {
  return recordTransaction(supabase, userId, "debit", amountJmd, kind, options);
}

/**
 * Read a user's current balance. Returns 0 if no wallet row exists
 * yet (we lazy-create on the first transaction).
 */
export async function getWalletBalance(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data } = await supabase
    .from("wallets")
    .select("balance_jmd")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { balance_jmd: number } | null)?.balance_jmd ?? 0;
}

/**
 * Convenience: check whether a user can afford a charge without
 * actually moving any money. Used by the ride booking gate.
 */
export async function hasSufficientBalance(
  supabase: SupabaseClient,
  userId: string,
  amountJmd: number,
): Promise<boolean> {
  const balance = await getWalletBalance(supabase, userId);
  return balance >= amountJmd;
}

/* ─────────────────────── internal ─────────────────────── */

async function recordTransaction(
  supabase: SupabaseClient,
  userId: string,
  direction: "credit" | "debit",
  amountJmd: number,
  kind: WalletKind,
  options: RecordOptions,
): Promise<Outcome> {
  if (!Number.isInteger(amountJmd) || amountJmd <= 0) {
    return { ok: false, error: "Amount must be a positive integer (JMD)." };
  }

  const { data, error } = await supabase
    .from("wallet_transactions")
    .insert({
      user_id: userId,
      direction,
      amount_jmd: amountJmd,
      kind,
      ride_id: options.rideId ?? null,
      related_user_id: options.relatedUserId ?? null,
      deposit_id: options.depositId ?? null,
      withdrawal_id: options.withdrawalId ?? null,
      transfer_id: options.transferId ?? null,
      description: options.description ?? null,
      metadata: options.metadata ?? null,
      // Trigger overwrites this with the actual computed balance,
      // but we have to pass a value because the column is NOT NULL.
      balance_after_jmd: 0,
    })
    .select("id, balance_after_jmd")
    .single();

  if (error) {
    // The trigger raises this exact phrase when a debit would go
    // below zero. Detect it so the caller can surface a "top up
    // your wallet" UX instead of a generic 500.
    const insufficientFunds =
      typeof error.message === "string" &&
      error.message.toLowerCase().includes("insufficient balance");
    return {
      ok: false,
      error: error.message,
      insufficientFunds: insufficientFunds || undefined,
    };
  }

  return {
    ok: true,
    balanceAfter: (data as { balance_after_jmd: number }).balance_after_jmd,
    transactionId: (data as { id: string }).id,
  };
}
