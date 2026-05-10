import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET /api/wallet/transactions/[id]
 *
 * Returns a single wallet transaction belonging to the calling user,
 * with whatever related-entity context we can hydrate: the ride or
 * route hail it paid for, the deposit + gateway reference, the
 * withdrawal status, the transfer counterparty, etc.
 *
 * Drives the rider/driver "transaction detail" screen — one row in the
 * wallet history → tap → see full receipt.
 */

type Hydrated = {
  ride: null | {
    id: string;
    pickupName: string | null;
    dropoffName: string | null;
    distanceKm: number | null;
    completedAt: string | null;
  };
  routeHail: null | {
    id: string;
    pickupName: string | null;
    dropoffName: string | null;
    distanceKm: number | null;
    completedAt: string | null;
    routeOrigin: string | null;
    routeDestination: string | null;
  };
  qrCharge: null | {
    id: string;
    code: string;
    description: string | null;
    confirmedAt: string | null;
  };
  deposit: null | {
    id: string;
    gateway: string;
    gatewayReference: string | null;
    status: string;
    completedAt: string | null;
  };
  withdrawal: null | {
    id: string;
    bankName: string | null;
    bankAccountNumber: string | null;
    status: string;
    paidAt: string | null;
  };
  counterparty: null | { name: string | null };
};

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

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

  const { data: txn } = await supabase
    .from("wallet_transactions")
    .select(
      "id, user_id, direction, amount_jmd, kind, ride_id, related_user_id, deposit_id, withdrawal_id, transfer_id, description, metadata, balance_after_jmd, created_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!txn) {
    return NextResponse.json({ error: "transaction not found" }, { status: 404 });
  }

  const hydrated: Hydrated = {
    ride: null,
    routeHail: null,
    qrCharge: null,
    deposit: null,
    withdrawal: null,
    counterparty: null,
  };

  // Ride (private trip)
  if (txn.ride_id) {
    const { data: ride } = await supabase
      .from("rides")
      .select(
        "id, pickup_name, dropoff_name, estimated_distance_km, completed_at",
      )
      .eq("id", txn.ride_id)
      .maybeSingle();
    if (ride) {
      hydrated.ride = {
        id: ride.id,
        pickupName: ride.pickup_name,
        dropoffName: ride.dropoff_name,
        distanceKm: ride.estimated_distance_km
          ? Number(ride.estimated_distance_km)
          : null,
        completedAt: ride.completed_at,
      };
    }
  }

  // Route hail (Mode B) and QR pay come through metadata. Older
  // metadata-less rows just degrade to "wallet activity".
  const meta = (txn.metadata ?? {}) as Record<string, unknown>;
  const routeHailId =
    typeof meta.route_hail_id === "string" ? meta.route_hail_id : null;
  const qrChargeId =
    typeof meta.qr_charge_id === "string" ? meta.qr_charge_id : null;

  if (routeHailId) {
    const { data: hail } = await supabase
      .from("route_hails")
      .select(
        "id, pickup_name, dropoff_name, distance_km, completed_at, route_id",
      )
      .eq("id", routeHailId)
      .maybeSingle();
    if (hail) {
      const { data: route } = await supabase
        .from("routes")
        .select("origin_name, destination_name")
        .eq("id", hail.route_id)
        .maybeSingle();
      hydrated.routeHail = {
        id: hail.id,
        pickupName: hail.pickup_name,
        dropoffName: hail.dropoff_name,
        distanceKm: Number(hail.distance_km),
        completedAt: hail.completed_at,
        routeOrigin: route?.origin_name ?? null,
        routeDestination: route?.destination_name ?? null,
      };
    }
  }

  if (qrChargeId) {
    const { data: charge } = await supabase
      .from("qr_charges")
      .select("id, code, description, confirmed_at")
      .eq("id", qrChargeId)
      .maybeSingle();
    if (charge) {
      hydrated.qrCharge = {
        id: charge.id,
        code: charge.code,
        description: charge.description,
        confirmedAt: charge.confirmed_at,
      };
    }
  }

  // Deposit / withdrawal context
  if (txn.deposit_id) {
    const { data: dep } = await supabase
      .from("wallet_deposits")
      .select("id, gateway, gateway_reference, status, completed_at")
      .eq("id", txn.deposit_id)
      .maybeSingle();
    if (dep) {
      hydrated.deposit = {
        id: dep.id,
        gateway: dep.gateway,
        gatewayReference: dep.gateway_reference,
        status: dep.status,
        completedAt: dep.completed_at,
      };
    }
  }
  if (txn.withdrawal_id) {
    const { data: wd } = await supabase
      .from("wallet_withdrawals")
      .select("id, bank_name, bank_account_number, status, paid_at")
      .eq("id", txn.withdrawal_id)
      .maybeSingle();
    if (wd) {
      hydrated.withdrawal = {
        id: wd.id,
        bankName: wd.bank_name,
        bankAccountNumber: wd.bank_account_number
          ? `••••${(wd.bank_account_number as string).slice(-4)}`
          : null,
        status: wd.status,
        paidAt: wd.paid_at,
      };
    }
  }

  // Counterparty (transfers, ride pairings)
  if (txn.related_user_id) {
    const { data: cp } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", txn.related_user_id)
      .maybeSingle();
    hydrated.counterparty = { name: cp?.full_name ?? null };
  }

  return NextResponse.json({
    transaction: {
      id: txn.id,
      direction: txn.direction,
      amountJmd: txn.amount_jmd,
      kind: txn.kind,
      description: txn.description,
      balanceAfterJmd: txn.balance_after_jmd,
      createdAt: txn.created_at,
    },
    related: hydrated,
  });
}
