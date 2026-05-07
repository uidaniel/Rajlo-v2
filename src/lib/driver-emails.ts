import { sendEmail } from "./email";

/**
 * Driver-facing transactional email templates. Brand colour, simple layout,
 * works in every email client (no fancy CSS).
 */

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function shell({
  preheader,
  title,
  intro,
  body,
  ctaLabel,
  ctaHref,
  footnote,
}: {
  preheader: string;
  title: string;
  intro: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  footnote?: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none!important;font-size:1px;color:#f6f6f4;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.04);">
          <tr>
            <td style="background:#f10100;padding:24px 28px;color:#ffffff;">
              <div style="font-weight:900;font-size:22px;letter-spacing:-0.01em;">Rajlo</div>
              <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;margin-top:4px;">Let's go!</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 8px 28px;">
              <h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:800;color:#111906;">${escapeHtml(title)}</h1>
              <p style="margin:12px 0 0;font-size:16px;line-height:1.55;color:#4b5563;">${intro}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 8px 28px;">${body}</td>
          </tr>
          <tr>
            <td style="padding:16px 28px 32px 28px;">
              <a href="${ctaHref}" style="display:inline-block;background:#f10100;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 24px;border-radius:999px;">${escapeHtml(ctaLabel)}</a>
            </td>
          </tr>
          ${
            footnote
              ? `<tr><td style="padding:0 28px 32px 28px;font-size:12px;line-height:1.6;color:#6b7077;">${footnote}</td></tr>`
              : ""
          }
          <tr>
            <td style="background:#111906;padding:20px 28px;color:#ffffffcc;font-size:11px;line-height:1.5;">
              <div style="font-weight:800;color:#ffffff;">Rajlo</div>
              <div style="margin-top:4px;">Jamaica's red-plate rideshare platform.</div>
              <div style="margin-top:12px;color:#ffffff80;">© ${new Date().getFullYear()} Rajlo · Kingston, Jamaica</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Sent when admin approves all docs and activates the driver. */
export async function sendDriverApprovedEmail({
  to,
  driverName,
  externalId,
}: {
  to: string;
  driverName: string;
  externalId: string;
}) {
  const html = shell({
    preheader: "Your Rajlo driver application has been approved.",
    title: `You're approved, ${escapeHtml(driverName.split(" ")[0] || "driver")}!`,
    intro:
      "Your TA documents have been verified and your Rajlo driver account is now active. Time to hit the road.",
    body: `
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px 16px;">
        <p style="margin:0;font-size:13px;color:#065f46;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Account activated</p>
        <p style="margin:6px 0 0;font-size:14px;color:#064e3b;">Driver ID: <strong>${escapeHtml(externalId)}</strong></p>
      </div>
      <p style="margin:18px 0 0;font-size:15px;line-height:1.6;color:#111906;">From here you can sign in, toggle online, and start receiving ride requests. Welcome to Rajlo.</p>
    `,
    ctaLabel: "Open driver dashboard",
    ctaHref: `${APP_URL}/auth/driver/login`,
    footnote:
      "Keep all TA documents current — your account auto-suspends if any expire. We'll email you 60 / 30 / 7 days before any document expires.",
  });

  return sendEmail({
    to,
    subject: "Your Rajlo driver account is activated 🎉",
    html,
    text: `You're approved! Your TA documents have been verified and your Rajlo driver account (${externalId}) is now active. Sign in: ${APP_URL}/auth/driver/login`,
  });
}

/** Sent when admin pulls an activated driver back into review. */
export async function sendDriverDeactivatedEmail({
  to,
  driverName,
  externalId,
  reason,
}: {
  to: string;
  driverName: string;
  externalId: string;
  reason: string | null;
}) {
  const reasonBlock = reason
    ? `<div style="background:#fde8e7;border:1px solid #f10100;border-radius:12px;padding:14px 16px;margin-top:14px;">
         <p style="margin:0;font-size:13px;color:#f10100;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Reason</p>
         <p style="margin:6px 0 0;font-size:14px;color:#111906;line-height:1.5;">${escapeHtml(reason)}</p>
       </div>`
    : "";

  const html = shell({
    preheader: "Your Rajlo driver account has been deactivated.",
    title: `Account deactivated, ${escapeHtml(driverName.split(" ")[0] || "driver")}`,
    intro:
      "Your Rajlo driver account has been deactivated and is back under review. You won't be able to accept ride requests until our team re-verifies your application.",
    body: `
      <div style="background:#fef7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px 16px;">
        <p style="margin:0;font-size:13px;color:#9a3412;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Status</p>
        <p style="margin:6px 0 0;font-size:14px;color:#7c2d12;">Driver ID: <strong>${escapeHtml(externalId)}</strong> · all documents reset to pending review</p>
      </div>
      ${reasonBlock}
      <p style="margin:18px 0 0;font-size:15px;line-height:1.6;color:#111906;">Sign in to see your verification status. Our operations team will reach out if any documents need to be replaced or refreshed.</p>
    `,
    ctaLabel: "Open driver portal",
    ctaHref: `${APP_URL}/auth/driver/login`,
    footnote:
      "Questions? Reply to this email or contact support — we're here to help.",
  });

  return sendEmail({
    to,
    subject: "Your Rajlo driver account has been deactivated",
    html,
    text: `Your Rajlo driver account (${externalId}) has been deactivated and is under review. ${reason ? "Reason: " + reason + " " : ""}Sign in: ${APP_URL}/auth/driver/login`,
  });
}

/** Sent when admin rejects/requests changes on one or more docs. */
export async function sendDriverRejectedEmail({
  to,
  driverName,
  externalId,
  adminNote,
}: {
  to: string;
  driverName: string;
  externalId: string;
  adminNote: string | null;
}) {
  const noteBlock = adminNote
    ? `<div style="background:#fde8e7;border:1px solid #f10100;border-radius:12px;padding:14px 16px;margin-top:14px;">
         <p style="margin:0;font-size:13px;color:#f10100;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Note from operations</p>
         <p style="margin:6px 0 0;font-size:14px;color:#111906;line-height:1.5;">${escapeHtml(adminNote)}</p>
       </div>`
    : "";

  const html = shell({
    preheader: "Action needed on your Rajlo driver application.",
    title: `Action needed, ${escapeHtml(driverName.split(" ")[0] || "driver")}`,
    intro:
      "Your application needs a few changes before we can activate your account. Once you resubmit, our team will re-review within 1–2 business days.",
    body: `
      <div style="background:#fef7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px 16px;">
        <p style="margin:0;font-size:13px;color:#9a3412;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Resubmission required</p>
        <p style="margin:6px 0 0;font-size:14px;color:#7c2d12;">Driver ID: <strong>${escapeHtml(externalId)}</strong></p>
      </div>
      ${noteBlock}
      <p style="margin:18px 0 0;font-size:15px;line-height:1.6;color:#111906;">Sign in and click <strong>Resubmit documents</strong> on your verification page. Your form fields and previously-approved files are still saved — you only need to re-upload the documents flagged for resubmission.</p>
    `,
    ctaLabel: "Resubmit documents",
    ctaHref: `${APP_URL}/auth/driver/login`,
    footnote:
      "If you have questions about the requirements, contact support or call the Transport Authority on 876-926-9937.",
  });

  return sendEmail({
    to,
    subject: "Action needed on your Rajlo driver application",
    html,
    text: `Your Rajlo driver application (${externalId}) needs changes. ${adminNote ? "Note from operations: " + adminNote + " " : ""}Sign in to resubmit: ${APP_URL}/auth/driver/login`,
  });
}
