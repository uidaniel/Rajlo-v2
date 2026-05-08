/**
 * Driver-facing transactional emails.
 *
 * Thin compatibility layer over the unified template system in
 * `email-templates.ts`. The named exports `sendDriverApprovedEmail`,
 * `sendDriverRejectedEmail`, and `sendDriverDeactivatedEmail` are kept
 * because the admin verification routes already import them — internally
 * they now route through the new beautiful renderer.
 */

import {
  driverApprovedTemplate,
  driverRejectedTemplate,
  driverDeactivatedTemplate,
} from "./email-templates";
import { sendEmail } from "./email";

export async function sendDriverApprovedEmail({
  to,
  driverName,
  externalId,
}: {
  to: string;
  driverName: string;
  externalId: string;
}) {
  const t = driverApprovedTemplate({ driverName, externalId });
  return sendEmail({ to, subject: t.subject, html: t.html, text: t.text });
}

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
  const t = driverRejectedTemplate({ driverName, externalId, adminNote });
  return sendEmail({ to, subject: t.subject, html: t.html, text: t.text });
}

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
  const t = driverDeactivatedTemplate({ driverName, externalId, reason });
  return sendEmail({ to, subject: t.subject, html: t.html, text: t.text });
}
