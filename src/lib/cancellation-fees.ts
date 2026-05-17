import type { SupabaseClient } from "@supabase/supabase-js";
import { debitWallet, creditWallet } from "./wallet";

/**
 * Cancellation & no-show fee schedule.
 *
 * Fee structure approved by Raj (2026-05-17), tuned for the Jamaican
 * market — light enough not to scare off new riders, firm enough to
 * protect driver time:
 *
 *   Rider cancels ≤ 2 min after requesting ............ J$0
 *   Rider cancels > 2 min, before the driver arrives .. J$100
 *   Rider cancels after the driver has arrived ........ J$200
 *   Rider no-shows after the driver's wait timer ...... J$300
 *
 * A fee is NEVER charged while a ride is still `requested` — no
 * driver has committed yet. Fees only begin once a driver has
 * accepted and is heading to pickup.
 *
 * Every fee splits 80/20: the driver keeps 80% as compensation for
 * wasted time and fuel, RAJLO keeps 20%.
 *
 * No-show wait timer — how long the driver must wait after marking
 * `arrived` before a no-show can be charged:
 *   Private Ride .... 5 minutes
 *   RAJLO Route ..... 2 minutes
 */

/** Grace period after requesting in which any cancel is free. */
export const FREE_CANCEL_WINDOW_SEC = 120;

export const CANCEL_FEE_BEFORE_ARRIVAL_JMD = 100;
export const CANCEL_FEE_AFTER_ARRIVAL_JMD = 200;
export const NO_SHOW_FEE_JMD = 300;

/** Seconds a driver must wait post-arrival before a no-show charge. */
export const NO_SHOW_WAIT_SEC: Record<"private" | "route", number> = {
  private: 5 * 60,
  route: 2 * 60,
};

/** The driver's share of any fee; the remainder is RAJLO's cut. */
export const FEE_DRIVER_SHARE_PCT = 80;

/** Settlement-status value stamped on a ride whose fee couldn't be
 *  collected (rider wallet too low). Admin reconciles these, and the
 *  rider is blocked from booking again until it clears. */
export const FEE_UNCOLLECTED_STATUS = "cancel_fee_uncollected";

export type FeeType = "cancellation" | "no_show";

/** Split a fee into the driver's compensation and RAJLO's cut. */
export function splitFee(feeJmd: number): {
  driverJmd: number;
  platformJmd: number;
} {
  const driverJmd = Math.round((feeJmd * FEE_DRIVER_SHARE_PCT) / 100);
  return { driverJmd, platformJmd: feeJmd - driverJmd };
}

/**
 * The cancellation fee a rider owes for cancelling now.
 *
 * Works for both private rides and route hails — a route hail never
 * reaches `arrived`, so it naturally only ever sees the J$0 / J$100
 * tiers.
 *
 * @param status      ride/hail status BEFORE the cancel
 *                    ('requested' | 'accepted' | 'arrived')
 * @param requestedAt ISO timestamp the ride/hail was requested
 * @param now         current time (injectable for tests)
 */
export function riderCancellationFeeJmd(
  status: string,
  requestedAt: string | null,
  now: Date = new Date(),
): number {
  // No driver committed yet → always free.
  if (status === "requested") return 0;

  // Driver has reached the pickup point → the higher fee.
  if (status === "arrived") return CANCEL_FEE_AFTER_ARRIVAL_JMD;

  // Driver accepted and is en route: free inside the grace window,
  // otherwise the standard pre-arrival fee.
  if (status === "accepted") {
    if (!requestedAt) return CANCEL_FEE_BEFORE_ARRIVAL_JMD;
    const elapsedSec = (now.getTime() - new Date(requestedAt).getTime()) / 1000;
    return elapsedSec <= FREE_CANCEL_WINDOW_SEC
      ? 0
      : CANCEL_FEE_BEFORE_ARRIVAL_JMD;
  }

  return 0;
}

/**
 * Whether a no-show charge is allowed yet — the driver must have
 * waited the full timer after marking `arrived`.
 */
export function noShowWaitElapsed(
  arrivedAt: string | null,
  mode: "private" | "route",
  now: Date = new Date(),
): { eligible: boolean; waitSec: number; elapsedSec: number } {
  const waitSec = NO_SHOW_WAIT_SEC[mode];
  if (!arrivedAt) return { eligible: false, waitSec, elapsedSec: 0 };
  const elapsedSec = (now.getTime() - new Date(arrivedAt).getTime()) / 1000;
  return { eligible: elapsedSec >= waitSec, waitSec, elapsedSec };
}

type ChargeResult =
  | { ok: true; driverCredited: boolean; driverJmd: number; platformJmd: number }
  | { ok: false; insufficientBalance: boolean; error: string };

/**
 * Charge a cancellation / no-show fee: debit the rider, then credit
 * the driver their 80% share.
 *
 * The fee reuses the `ride_charge` / `ride_earning` wallet kinds (with
 * `metadata.feeType` distinguishing it) so no DB CHECK-constraint
 * migration is needed — the human-readable `description` keeps the
 * wallet history clear.
 *
 * If the rider's wallet can't cover the fee the driver is NOT credited
 * (the platform never pays out money it didn't collect) — the caller
 * records the ride as fee-uncollected for admin reconciliation.
 */
export async function chargeFee(
  supabase: SupabaseClient,
  args: {
    riderId: string;
    driverUserId: string | null;
    feeJmd: number;
    rideId: string;
    feeType: FeeType;
    /** Human label for the wallet description, e.g. "Half Way Tree → New Kingston". */
    label: string;
  },
): Promise<ChargeResult> {
  const { riderId, driverUserId, feeJmd, rideId, feeType, label } = args;
  const { driverJmd, platformJmd } = splitFee(feeJmd);
  const feeLabel = feeType === "no_show" ? "No-show fee" : "Cancellation fee";
  const metadata = { feeType, grossFeeJmd: feeJmd, platformCutJmd: platformJmd };

  const debit = await debitWallet(supabase, riderId, feeJmd, "ride_charge", {
    rideId,
    description: `${feeLabel} · ${label}`,
    metadata,
  });
  if (!debit.ok) {
    return {
      ok: false,
      insufficientBalance: debit.insufficientFunds === true,
      error: debit.error,
    };
  }

  // Compensate the driver. Best-effort — the rider has already been
  // charged, so a credit failure must not fail the whole operation;
  // the caller flags the ride for admin if this returns false.
  let driverCredited = false;
  if (driverUserId && driverJmd > 0) {
    const credit = await creditWallet(
      supabase,
      driverUserId,
      driverJmd,
      "ride_earning",
      {
        rideId,
        description: `${feeLabel} compensation · ${label}`,
        metadata,
      },
    );
    driverCredited = credit.ok;
  }

  return { ok: true, driverCredited, driverJmd, platformJmd };
}
