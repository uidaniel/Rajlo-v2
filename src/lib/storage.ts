import { createSupabaseBrowserClient } from "./supabase-browser";

const BUCKET = "driver-documents";

/**
 * Uploads a single driver document directly from the browser to Supabase
 * Storage. Files are stored under `<user_id>/<doc_key>-<timestamp>.<ext>`
 * so RLS can scope them per-driver (see storage-migration.sql).
 */
export async function uploadDriverDocument({
  userId,
  docKey,
  file,
}: {
  userId: string;
  docKey: string;
  file: File;
}): Promise<{ path: string } | { error: string }> {
  const supabase = createSupabaseBrowserClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${userId}/${docKey}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) return { error: error.message };
  return { path };
}

/**
 * Removes a previously-uploaded file. Used when the driver picks a different
 * file to replace one already uploaded.
 */
export async function removeDriverDocument(path: string) {
  const supabase = createSupabaseBrowserClient();
  await supabase.storage.from(BUCKET).remove([path]);
}

/**
 * Returns a short-lived signed URL for previewing/downloading a file. Used
 * server-side from admin verification routes. `expiresIn` is in seconds.
 */
export async function createDriverDocumentSignedUrl(
  path: string,
  expiresIn = 60 * 5,
): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
