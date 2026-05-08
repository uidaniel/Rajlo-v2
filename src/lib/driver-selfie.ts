import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve a driver's selfie photo to a signed storage URL.
 *
 * The selfie lives in the private `driver-documents` bucket under the
 * driver's own `auth.user_id` folder, so we have to sign on demand.
 * service_role client bypasses RLS for the lookup + sign call.
 *
 * Used everywhere a rider sees a driver's "real" photo:
 *   - Live trip card
 *   - History detail / receipt page
 *   - Public trip-share page
 *   - Driver's own sidebar avatar
 *
 * Returns null when:
 *   - The driver hasn't uploaded a selfie yet (still in onboarding)
 *   - The doc exists but file_path is null (legacy rows from before
 *     the storage migration)
 *   - The sign call fails for any reason — caller should fall back
 *     to the OAuth profile avatar.
 *
 * 24h expiry — long enough that a rider mid-trip won't get a broken
 * image, short enough that a leaked URL becomes useless quickly.
 */
const SELFIE_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

export async function getDriverSelfieUrl(
  supabase: SupabaseClient,
  driverInternalId: string,
): Promise<string | null> {
  const { data: doc } = await supabase
    .from("driver_documents")
    .select("file_path")
    .eq("driver_id", driverInternalId)
    .eq("doc_key", "selfie")
    .maybeSingle();

  if (!doc?.file_path) return null;

  const { data: signed, error } = await supabase.storage
    .from("driver-documents")
    .createSignedUrl(doc.file_path, SELFIE_SIGNED_URL_TTL_SECONDS);

  if (error || !signed?.signedUrl) return null;
  return signed.signedUrl;
}
