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
        // Flip the driver offline before signing out. The endpoint
        // refuses with 409 when an active trip is in flight; we
        // surface that to the user and abort rather than logging them
        // out with a rider still on board. 403s (non-driver) flow
        // through silently.
        const res = await fetch("/api/driver/online", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ online: false }),
        }).catch(() => null);
        if (res && res.status === 409) {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          alert(
            body.message ??
              "You can't sign out while a trip is in progress. Finish or cancel the current ride first.",
          );
          return;
        }
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
