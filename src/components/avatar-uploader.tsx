"use client";

import { useRef, useState } from "react";
import { Icon } from "./icons";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Avatar upload tile. Shared by /rider/profile and /driver/profile.
 *
 * Flow:
 *   1. User clicks the avatar → file picker
 *   2. Client validates type + size
 *   3. Client uploads to the public `avatars` bucket at
 *      `<auth.uid>/avatar-<ts>.<ext>` (RLS scopes the write to the
 *      user's own folder)
 *   4. Get the public URL from storage
 *   5. PATCH /api/me/profile with the new URL so it persists in the
 *      profiles row + everything that reads avatar_url picks it up
 *   6. Fire onUploaded(url) so the parent page can swap the
 *      visible image without a page refresh
 *
 * For drivers, this updates the OAuth-style avatar — the verified TA
 * selfie is a separate document and stays untouched. Riders see the
 * driver's selfie everywhere; the avatar shows in the driver's own
 * sidebar.
 */

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — generous, covers
                                         // un-resized phone photos.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function AvatarUploader({
  currentUrl,
  fallbackInitials,
  size = "lg",
  onUploaded,
}: {
  /** Currently-displayed avatar URL. Null → falls back to initials. */
  currentUrl: string | null;
  /** Initials shown when there's no avatar yet. */
  fallbackInitials: string;
  /** Visual size of the avatar tile. */
  size?: "md" | "lg";
  /** Called after a successful upload + PATCH with the new URL. */
  onUploaded: (newUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dimensionClass =
    size === "lg" ? "h-24 w-24 text-2xl" : "h-20 w-20 text-xl";

  const onPick = () => inputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so the same file can be picked again
    if (!file) return;

    setError(null);

    // Validate locally before burning bandwidth on the upload.
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Use a JPG, PNG or WEBP image.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Image is too large. Keep it under 5 MB.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You're not signed in.");

      // Path convention enforced by storage RLS: <auth.uid>/<file>
      // The timestamp suffix makes each upload a fresh path so the
      // URL is naturally cache-busted across changes.
      const ext = (file.name.split(".").pop() ?? "jpg")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 5);
      const path = `${user.id}/avatar-${Date.now()}.${ext || "jpg"}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);
      const newUrl = pub.publicUrl;

      // Persist the URL to profiles via the server endpoint — the
      // client doesn't have RLS write access to profiles for arbitrary
      // fields, and going through the endpoint keeps name + avatar
      // updates symmetric.
      const patchRes = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: newUrl }),
      });
      if (!patchRes.ok) {
        const j = (await patchRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(j.error ?? `Couldn't save avatar (${patchRes.status})`);
      }

      onUploaded(newUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload avatar.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onPick}
        disabled={uploading}
        aria-label="Change profile picture"
        className={`group relative grid ${dimensionClass} place-items-center overflow-hidden rounded-full bg-primary-soft font-extrabold text-rajlo-red ring-2 ring-rajlo-red/20 transition-all hover:ring-rajlo-red disabled:cursor-wait disabled:opacity-70`}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          fallbackInitials
        )}

        {/* Camera badge — always visible bottom-right, signals
           tap-to-change. Glows on hover. */}
        <span
          aria-hidden
          className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-rajlo-red text-white shadow-md transition-transform group-hover:-translate-y-0.5"
        >
          {uploading ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Icon name="upload" className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        onChange={onChange}
        className="sr-only"
      />

      {error && (
        <p className="max-w-xs text-xs font-semibold text-rajlo-red">
          {error}
        </p>
      )}
      {!error && (
        <p className="text-[11px] text-muted">
          {uploading ? "Uploading…" : "Tap to change · JPG / PNG / WEBP · 5 MB max"}
        </p>
      )}
    </div>
  );
}
