import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { notifyDriver } from "@/lib/notify";

/**
 * GET /api/cron/document-expiry
 *
 * Daily scheduled sweep (Vercel Cron — see vercel.json) that enforces
 * the TA-document lifecycle:
 *
 *   - A document whose `expires_on` date has passed is marked
 *     `expired`, and any driver still `activated` on an expired
 *     document is AUTO-SUSPENDED (activated → false, deactivated_at
 *     stamped). They re-upload the document to be re-reviewed.
 *   - A document expiring within the next 14 days is flagged
 *     `expiring_soon` so the verification queue + the driver get a
 *     warning before the hard cutoff.
 *
 * This is the automation behind the "we re-verify documents and
 * suspend lapsed accounts" promise — before it existed, expiry was
 * only ever caught by manual admin review.
 *
 * Auth: Vercel Cron attaches `Authorization: Bearer $CRON_SECRET`.
 * When CRON_SECRET is configured we require it so a random caller
 * can't trigger mass document churn.
 */

const EXPIRING_SOON_WINDOW_DAYS = 14;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "service_role_missing" },
      { status: 500 },
    );
  }

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10); // YYYY-MM-DD
  const soonCutoff = new Date(
    Date.now() + EXPIRING_SOON_WINDOW_DAYS * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);

  // ─── 1. Expired documents ───
  // A doc that was `approved` OR already flagged `expiring_soon` and
  // whose date has now passed becomes `expired`.
  const { data: expiredDocs } = await supabase
    .from("driver_documents")
    .select("id, driver_id")
    .in("status", ["approved", "expiring_soon"])
    .not("expires_on", "is", null)
    .lt("expires_on", today);

  const expiredDocIds = (expiredDocs ?? []).map((d) => d.id);
  if (expiredDocIds.length > 0) {
    await supabase
      .from("driver_documents")
      .update({ status: "expired", updated_at: nowIso })
      .in("id", expiredDocIds);
  }

  // Drivers with at least one freshly-expired document → auto-suspend
  // any that are still activated.
  const affectedDriverIds = Array.from(
    new Set((expiredDocs ?? []).map((d) => d.driver_id)),
  );
  let suspendedCount = 0;
  for (const driverId of affectedDriverIds) {
    const { data: driver } = await supabase
      .from("drivers")
      .select("id, user_id, activated")
      .eq("id", driverId)
      .maybeSingle();
    if (!driver || !driver.activated) continue;

    await supabase
      .from("drivers")
      .update({
        activated: false,
        deactivated_at: nowIso,
        admin_note:
          "Auto-suspended — a required TA document has expired. Re-upload the document to be re-reviewed.",
        updated_at: nowIso,
      })
      .eq("id", driver.id);
    suspendedCount += 1;

    await supabase.from("driver_audit_logs").insert({
      driver_id: driver.id,
      actor_role: "system",
      actor_id: "cron:document-expiry",
      event: "Auto-suspended — a required TA document expired",
    });

    if (driver.user_id) {
      await notifyDriver(supabase, {
        driverUserId: driver.user_id,
        kind: "verification",
        title: "Account suspended — document expired",
        body: "A required TA document has expired. Re-upload it to get re-verified and back online.",
        href: "/driver/renew",
        cta: "Renew documents",
        pushTag: "document-expiry-suspension",
      }).catch(() => null);
    }
  }

  // ─── 2. Expiring-soon warnings ───
  // Approved docs inside the warning window get flagged so the driver
  // (and the admin queue) see it coming.
  const { data: soonDocs } = await supabase
    .from("driver_documents")
    .select("id, driver_id")
    .eq("status", "approved")
    .not("expires_on", "is", null)
    .gte("expires_on", today)
    .lte("expires_on", soonCutoff);

  const soonDocIds = (soonDocs ?? []).map((d) => d.id);
  if (soonDocIds.length > 0) {
    await supabase
      .from("driver_documents")
      .update({ status: "expiring_soon", updated_at: nowIso })
      .in("id", soonDocIds);

    // One heads-up per affected driver (not per document).
    const soonDriverIds = Array.from(
      new Set((soonDocs ?? []).map((d) => d.driver_id)),
    );
    for (const driverId of soonDriverIds) {
      const { data: driver } = await supabase
        .from("drivers")
        .select("user_id, activated")
        .eq("id", driverId)
        .maybeSingle();
      if (driver?.user_id && driver.activated) {
        await notifyDriver(supabase, {
          driverUserId: driver.user_id,
          kind: "verification",
          title: "A TA document is expiring soon",
          body: "Renew it before it lapses to avoid having your account suspended.",
          href: "/driver/renew",
          cta: "Renew documents",
          pushTag: "document-expiring-soon",
        }).catch(() => null);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    expiredDocuments: expiredDocIds.length,
    driversSuspended: suspendedCount,
    expiringSoonFlagged: soonDocIds.length,
  });
}
