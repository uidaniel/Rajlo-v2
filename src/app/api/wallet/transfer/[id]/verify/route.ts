import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { creditWallet } from "@/lib/wallet";
import { enforceUserRateLimit } from "@/lib/rate-limit";

/**
 * Constant-time hex compare. We hash the user-submitted code with SHA-256
 * (32 bytes / 64 hex chars) before comparing, but a plain `===` on the
 * hex strings still leaks bytes-equal-up-to-N timing — which an attacker
 * could exploit to learn the stored hash one byte at a time. Decoding
 * both sides to fixed-length Buffers and using timingSafeEqual closes
 * that gap. We also sanity-check the byte length so a malformed input
 * can't crash the compare.
 */
function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * POST /api/wallet/transfer/[id]/verify
 *
 * Sender submits the OTP. On match:
 *   - Credit the recipient's wallet ('transfer_in').
 *   - Mark the transfer 'completed'.
 * If the OTP is wrong:
 *   - Increment attempts. After 5 bad tries, mark the transfer
 *     'cancelled' and refund the sender so a stolen device can't
 *     keep guessing.
 * If the transfer expired or is already completed/cancelled, the
 * caller gets a clear error.
 *
 * Body: { code: string }   // 6-digit OTP
 */

const MAX_ATTEMPTS = 5;

type Body = { code?: unknown };

export async function POST(
  request: Request,
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

  // Per-user throttle on verify attempts. The 5-attempt account lockout
  // already exists below — this rate limit just makes sure those 5
  // attempts can't be burned through in milliseconds by a brute-force
  // script. 10 attempts per minute is forgiving for a real human
  // mistyping the code.
  const limited = enforceUserRateLimit(user.id, {
    prefix: "wallet:transfer-verify",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!/^\d{4,8}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-digit code from your email." },
      { status: 400 },
    );
  }

  const { data: transfer } = await supabase
    .from("wallet_transfers")
    .select(
      "id, sender_id, recipient_id, amount_jmd, otp_hash, otp_attempts, status, expires_at",
    )
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
  if (new Date(transfer.expires_at).getTime() < Date.now()) {
    // Auto-expire: mark + refund. The pending-cleanup cron we'll
    // build later does this in batch; this branch is the "user
    // happened to be here when it expired" path.
    await markExpiredAndRefund(supabase, transfer);
    return NextResponse.json(
      { error: "This code expired — start a new transfer." },
      { status: 410 },
    );
  }

  const submittedHash = createHash("sha256").update(code).digest("hex");
  if (!constantTimeHexEqual(submittedHash, transfer.otp_hash)) {
    const nextAttempts = transfer.otp_attempts + 1;
    if (nextAttempts >= MAX_ATTEMPTS) {
      // Five wrong tries → kill the transfer and refund.
      await supabase
        .from("wallet_transfers")
        .update({
          otp_attempts: nextAttempts,
          status: "cancelled",
        })
        .eq("id", transfer.id);
      await creditWallet(
        supabase,
        transfer.sender_id,
        transfer.amount_jmd,
        "transfer_in",
        {
          transferId: transfer.id,
          relatedUserId: transfer.recipient_id,
          description: "Refund — too many wrong codes",
        },
      );
      return NextResponse.json(
        {
          error:
            "Too many wrong codes — the transfer was cancelled and your balance refunded.",
        },
        { status: 423 },
      );
    }
    await supabase
      .from("wallet_transfers")
      .update({ otp_attempts: nextAttempts })
      .eq("id", transfer.id);
    return NextResponse.json(
      {
        error: `Wrong code. ${MAX_ATTEMPTS - nextAttempts} attempt${MAX_ATTEMPTS - nextAttempts === 1 ? "" : "s"} left.`,
      },
      { status: 401 },
    );
  }

  // OTP matches. Credit the recipient and mark the transfer done.
  // The sender was already debited at initiate time.
  const credit = await creditWallet(
    supabase,
    transfer.recipient_id,
    transfer.amount_jmd,
    "transfer_in",
    {
      transferId: transfer.id,
      relatedUserId: transfer.sender_id,
      description: "Received from another rider",
    },
  );
  if (!credit.ok) {
    return NextResponse.json(
      { error: `Couldn't credit recipient: ${credit.error}` },
      { status: 500 },
    );
  }

  await supabase
    .from("wallet_transfers")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", transfer.id);

  return NextResponse.json({ ok: true });
}

async function markExpiredAndRefund(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  transfer: {
    id: string;
    sender_id: string;
    recipient_id: string;
    amount_jmd: number;
  },
) {
  if (!supabase) return;
  await supabase
    .from("wallet_transfers")
    .update({ status: "expired" })
    .eq("id", transfer.id);
  await creditWallet(
    supabase,
    transfer.sender_id,
    transfer.amount_jmd,
    "transfer_in",
    {
      transferId: transfer.id,
      relatedUserId: transfer.recipient_id,
      description: "Refund — transfer code expired",
    },
  );
}
