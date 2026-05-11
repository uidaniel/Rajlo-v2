import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { sendEmail } from "@/lib/email";

/**
 * POST /api/rider/rides/[id]/sos
 *
 * Rider raises a safety alert during a trip. Three flavours:
 *   - kind=sos          → panic; ops gets emailed immediately and the
 *                          alert lands on the admin dashboard.
 *   - kind=flag         → softer "something feels off" report.
 *   - kind=unusual_stop → auto-created by the rider's app when the
 *                          driver has been stationary too long during
 *                          an in-progress trip. Opens a check-in
 *                          modal on the rider's side; if the rider
 *                          confirms safe, the alert is resolved
 *                          without paging ops. If the rider escalates
 *                          (taps SOS or doesn't respond), ops gets the
 *                          full context including the original
 *                          unusual_stop coordinates.
 *
 * Body: { kind, message?, lat?, lng? }
 *
 * Email is best-effort (failures don't block the DB write).
 */
type SosRequest = {
  kind: "sos" | "flag" | "unusual_stop";
  message?: string;
  lat?: number;
  lng?: number;
};

const ALLOWED_KINDS: ReadonlyArray<SosRequest["kind"]> = [
  "sos",
  "flag",
  "unusual_stop",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as SosRequest;

  if (!ALLOWED_KINDS.includes(body.kind)) {
    return NextResponse.json(
      { error: "kind must be 'sos', 'flag', or 'unusual_stop'" },
      { status: 400 },
    );
  }

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

  // Verify the ride belongs to this rider + grab the driver assignment.
  const { data: ride } = await supabase
    .from("rides")
    .select(
      "id, rider_id, driver_id, status, pickup_name, dropoff_name",
    )
    .eq("id", id)
    .eq("rider_id", user.id)
    .maybeSingle();
  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  const lat = Number.isFinite(body.lat) ? body.lat : null;
  const lng = Number.isFinite(body.lng) ? body.lng : null;

  const { data: alert, error: insertError } = await supabase
    .from("safety_alerts")
    .insert({
      ride_id: ride.id,
      rider_id: user.id,
      driver_id: ride.driver_id,
      kind: body.kind,
      message: body.message?.trim() || null,
      lat,
      lng,
      status: "open",
    })
    .select("id")
    .single();

  if (insertError || !alert) {
    return NextResponse.json(
      {
        error: `Couldn't record alert: ${insertError?.message ?? "unknown error"}`,
      },
      { status: 500 },
    );
  }

  // Email gating: we only ping ops for SOS and flag events. The
  // `unusual_stop` kind is a system-triggered check-in — the rider's
  // app is asking them whether they're OK. If the rider escalates
  // (taps SOS in the modal) the client fires a SECOND POST with
  // kind=sos which emails ops then. If the rider dismisses with
  // "I'm fine" they PATCH this alert to resolved without any email.
  // This avoids alert fatigue from every red-light stop.
  const shouldEmailOps = body.kind === "sos" || body.kind === "flag";

  // Best-effort ops email. We pull rider's display name from profiles for
  // the alert subject; fall back to "a rider" if missing.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const riderName = profile?.full_name?.trim() || "a rider";

  const opsEmail = process.env.SAFETY_OPS_EMAIL;
  if (shouldEmailOps && opsEmail) {
    const subject =
      body.kind === "sos"
        ? `🚨 SOS — ${riderName} during trip ${ride.id.slice(0, 8)}`
        : `⚠ Safety flag — ${riderName} during trip ${ride.id.slice(0, 8)}`;

    const locLink =
      lat !== null && lng !== null
        ? `https://www.google.com/maps?q=${lat},${lng}`
        : null;

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h1 style="color:${body.kind === "sos" ? "#f10100" : "#9a3412"};font-size:22px;margin:0 0 12px;">
          ${body.kind === "sos" ? "🚨 SOS triggered" : "⚠ Safety flag raised"}
        </h1>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#111906;">
          <strong>${riderName}</strong> raised a${body.kind === "sos" ? " SOS" : " flag"}
          during trip <code>${ride.id}</code>.
        </p>
        <table style="margin-top:16px;font-size:13px;line-height:1.6;">
          <tr><td style="padding-right:12px;color:#5b6068;">Pickup</td><td>${escapeHtml(ride.pickup_name)}</td></tr>
          <tr><td style="padding-right:12px;color:#5b6068;">Dropoff</td><td>${escapeHtml(ride.dropoff_name)}</td></tr>
          <tr><td style="padding-right:12px;color:#5b6068;">Trip status</td><td>${ride.status}</td></tr>
          ${
            locLink
              ? `<tr><td style="padding-right:12px;color:#5b6068;">Last known position</td><td><a href="${locLink}">${lat?.toFixed(5)}, ${lng?.toFixed(5)}</a></td></tr>`
              : ""
          }
          ${
            body.message
              ? `<tr><td style="padding-right:12px;color:#5b6068;vertical-align:top;">Message</td><td>${escapeHtml(body.message)}</td></tr>`
              : ""
          }
        </table>
        <p style="margin-top:24px;font-size:13px;color:#5b6068;">
          Open the admin console to acknowledge and resolve.
        </p>
      </div>`;

    await sendEmail({
      to: opsEmail,
      subject,
      html,
      text: `${subject}\n\nRider: ${riderName}\nRide: ${ride.id}\nPickup: ${ride.pickup_name}\nDropoff: ${ride.dropoff_name}\nStatus: ${ride.status}${locLink ? `\nPosition: ${locLink}` : ""}${body.message ? `\nMessage: ${body.message}` : ""}`,
    });
  }

  return NextResponse.json({ ok: true, alertId: alert.id });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
