"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { clearSessionPolicy } from "@/lib/session-policy";
import { Icon } from "./icons";

/**
 * Small sign-out button for surfaces that don't have the full sidebar
 * (e.g. /driver/pending, /driver/onboarding). Bounces to the driver login
 * page after sign-out.
 */
export function SignOutButton({
  className = "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface-soft hover:text-foreground md:text-sm",
  redirectTo = "/auth/driver/login",
}: {
  className?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        // Best-effort: flip the driver offline before signing out so
        // their last-known intent is "off" if they don't sign back in.
        // The endpoint silently 403s for non-driver users — safe to
        // call unconditionally.
        await fetch("/api/driver/online", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ online: false }),
        }).catch(() => null);
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        clearSessionPolicy();
        router.push(redirectTo);
        router.refresh();
      }}
      className={className}
    >
      <Icon name="log-out" className="h-3.5 w-3.5" />
      Sign out
    </button>
  );
}
