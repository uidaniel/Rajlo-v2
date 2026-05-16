/**
 * Client-side image compression — run before any Supabase Storage
 * upload.
 *
 * Why this exists: phone cameras produce 3–8 MB JPEGs. Uploaded raw,
 * every avatar render and every admin document review re-downloads
 * those megabytes from Supabase Storage — which is the single largest
 * driver of Supabase egress. Downscaling + re-encoding a 4 MB photo to
 * ~250 KB cuts both the egress AND the stored size by ~90% with no
 * visible quality loss at the sizes we actually display.
 *
 * Approach: draw the image onto a canvas at a capped max dimension,
 * re-encode as JPEG at a fixed quality. `createImageBitmap` with
 * `imageOrientation: "from-image"` bakes in EXIF rotation so phone
 * photos that were shot sideways come out upright (a raw upload would
 * keep the rotation metadata and render rotated in some viewers).
 *
 * Safety: anything that isn't a raster image (PDF uploads, etc.) is
 * returned untouched. If compression somehow produces a LARGER file
 * than the original (already-optimised tiny images), the original is
 * kept. So calling this is always safe — worst case it's a no-op.
 */

export type CompressOptions = {
  /** Longest-edge cap in pixels. The image is scaled down so neither
   *  dimension exceeds this; it's never scaled up. */
  maxDimension: number;
  /** JPEG quality, 0..1. 0.82 is visually lossless for photos at
   *  display sizes. */
  quality?: number;
};

export async function compressImage(
  file: File,
  { maxDimension, quality = 0.82 }: CompressOptions,
): Promise<File> {
  // Non-images (PDF scans of documents, etc.) pass straight through —
  // there's nothing a canvas can do with them.
  if (!file.type.startsWith("image/")) return file;
  // SVGs and GIFs would lose animation / vector-ness through a canvas
  // round-trip — skip them too.
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }
  // Guard: canvas APIs aren't available server-side.
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxDimension / longestEdge);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });
    if (!blob) return file;

    // If compression didn't actually help (rare — tiny pre-optimised
    // images), keep the original so we never make things worse.
    if (blob.size >= file.size) return file;

    // Re-name with a .jpg extension since we always re-encode to JPEG.
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    // Any decode/encode failure → fall back to the untouched file so
    // the upload still succeeds.
    return file;
  }
}

/** Avatar preset — 512px is ample for every avatar render in the app
 *  (largest is ~96px @3x). Cuts a 5 MB selfie to ~40–80 KB. */
export const AVATAR_COMPRESS: CompressOptions = {
  maxDimension: 512,
  quality: 0.82,
};

/** Driver-document preset — 1600px keeps licence / ID text legible for
 *  the admin verification review while still cutting a 4 MB phone
 *  photo to ~300–500 KB. */
export const DOCUMENT_COMPRESS: CompressOptions = {
  maxDimension: 1600,
  quality: 0.84,
};

/** Ride-chat photo preset — 1280px is plenty for an in-trip photo
 *  (a rider showing a landmark, a driver showing a parking spot).
 *  Audio messages and other non-images pass through untouched. */
export const CHAT_COMPRESS: CompressOptions = {
  maxDimension: 1280,
  quality: 0.8,
};
