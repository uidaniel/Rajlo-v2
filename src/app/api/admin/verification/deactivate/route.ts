import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { sendDriverDeactivatedEmail } from "@/lib/driver-emails";
import { notifyDriver } from "@/lib/notify";

/**
 * POST /api/admin/verification/deactivate
 *
 * Admin-only. Pulls an activated driver back into the verification queue:
 *   - drivers.activated         → false
 *   - drivers.onboarding_status → 'pending_review'
 *   - drivers.admin_note        → reason (or null)
 *   - drivers.submitted_at      → now (so the queue ordering reflects when
 *                                   the re-review was triggered)
 *   - driver_documents.status   → 'pending' for every doc
 *
 * The driver gets an email letting them know their account is under review
 * again. Used when documents expire, compliance flags arise, or operations
 * needs to re-verify.
 *
 * Body shape:
 *   { driverId: string, reason?: string }
 */
type DeactivateRequest = {
  driverId: string;
  reason?: string;
};

export async function POST(request: Request) {
  // Admin-only
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: profile } = await auth
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as DeactivateRequest;
  if (!body?.driverId) {
    return NextResponse.json(
      { error: "driverId is required" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      source: "mock",
      message: "Deactivation accepted in mock mode.",
    });
  }

  // Find the driver by external_id and confirm they're activated.
  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select(
      "id, external_id, first_name, last_name, email, activated, onboarding_status, user_id",
    )
    .eq("external_id", body.driverId)
    .maybeSingle();

  if (driverError || !driver) {
    return NextResponse.json(
      { error: "Driver not found" },
      { status: 404 },
    );
  }

  if (!driver.activated) {
    return NextResponse.json(
      { error: "Driver is not currently activated" },
      { status: 409 },
    );
  }

  // Reset driver row. `deactivated_at` is the canonical marker that the
  // pending page reads to render the dedicated "account deactivated" hero
  // instead of the standard "verification in progress" copy.
  const reason = body.reason?.trim() || null;
  const { error: updateError } = await supabase
    .from("drivers")
    .update({
      activated: false,
      onboarding_status: "pending_review",
      admin_note: reason,
      submitted_at: new Date().toISOString(),
      deactivated_at: new Date().toISOString(),
    })
    .eq("id", driver.id);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to deactivate driver: ${updateError.message}` },
      { status: 500 },
    );
  }

  // Reset every document back to pending. Files stay attached so the admin
  // can re-review in place. Every doc was approved a moment ago (the driver
  // was active), so flagging `previously_approved=true` lets the verification
  // detail page show the "previously approved · needs re-review" indicator
  // for each one.
  const { error: docsError } = await supabase
    .from("driver_documents")
    .update({
      status: "pending",
      note: "Driver pulled back into review by admin",
      reviewed_by: null,
      reviewed_at: null,
      previously_approved: true,
    })
    .eq("driver_id", driver.id);

  if (docsError) {
    return NextResponse.json(
      { error: `Failed to reset documents: ${docsError.message}` },
      { status: 500 },
    );
  }

  await supabase.from("driver_audit_logs").insert({
    driver_id: driver.id,
    actor_role: "admin",
    actor_id: "admin-web",
    event: reason
      ? `Driver deactivated; re-verification required. Reason: ${reason}`
      : "Driver deactivated; re-verification required",
  });

  // Notify the driver. Same pattern as decision route — failure here doesn't
  // block the API; the DB state is what matters.
  let emailStatus: "sent" | "skipped" | "failed" = "skipped";
  let emailError: string | null = null;
  if (driver.email) {
    const driverName =
      [driver.first_name, driver.last_name].filter(Boolean).join(" ") ||
      "driver";
    const result = await sendDriverDeactivatedEmail({
      to: driver.email,
      driverName,
      externalId: driver.external_id,
      reason,
    });
    if (result.ok) {
      emailStatus = "sent";
    } else if ("skipped" in result) {
      emailStatus = "skipped";
    } else {
      emailStatus = "failed";
      emailError = result.error;
    }
  }

  // Inbox row + web push.
  if (driver.user_id) {
    void notifyDriver(supabase, {
      driverUserId: driver.user_id,
      kind: "verification",
      title: "Account deactivated",
      body: reason
        ? `Reason: ${reason.slice(0, 140)}`
        : "Your driver account is back under review. Open the portal for details.",
      href: "/driver/pending",
      cta: "Open driver portal",
      pushTag: `driver-deactivated-${driver.external_id}`,
      pushRenotify: true,
    });
  }

  return NextResponse.json({
    ok: true,
    source: "supabase",
    email: { status: emailStatus, error: emailError },
  });
}
