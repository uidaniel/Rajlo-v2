import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LegalRole } from "./legal-documents";
import {
  getAllEffectiveLegalDocuments,
  type EffectiveLegalDocument,
} from "./legal-store";

/**
 * Server-side legal-consent helpers.
 *
 * The core question every gate asks: "which policies does this user
 * still owe an acceptance for?" — either because they've never
 * accepted them, or because the policy has been republished at a newer
 * version since they last accepted.
 *
 * Versions are read from the EFFECTIVE document (the admin-published DB
 * copy if one exists, otherwise the committed baseline), so an admin
 * bumping a policy version from the admin panel immediately puts every
 * affected user back behind the consent gate — no deploy.
 */

/**
 * Returns the effective documents `role` must accept that the user has
 * NOT accepted at the current version. Empty array = fully consented.
 *
 * Reads `legal_acceptances` through the passed client — with the
 * caller's auth client, RLS scopes it to the user's own rows.
 */
export async function getOutstandingLegalDocuments(
  supabase: SupabaseClient,
  userId: string,
  role: LegalRole,
): Promise<EffectiveLegalDocument[]> {
  const all = await getAllEffectiveLegalDocuments();
  const required = all.filter(
    (doc) => doc.audience === "everyone" || doc.audience === role,
  );

  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("doc_key, version")
    .eq("user_id", userId);

  // Fail closed: if the consent ledger can't be read, treat EVERY
  // required document as outstanding. A gate that errored open would
  // let an un-consented user through — the opposite of what this
  // system exists to guarantee.
  if (error) return required;

  const accepted = new Set(
    (data ?? []).map(
      (row) =>
        `${(row as { doc_key: string }).doc_key}@${(row as { version: string }).version}`,
    ),
  );

  return required.filter((doc) => !accepted.has(`${doc.key}@${doc.version}`));
}

/**
 * Maps a `profiles.role` value to a consent role. Admins and safety
 * officers are internal staff and are not gated by the rider/driver
 * consent flow, so they map to `null`.
 */
export function consentRoleFromProfileRole(
  role: string | null | undefined,
): LegalRole | null {
  if (role === "rider" || role === "driver") return role;
  return null;
}
