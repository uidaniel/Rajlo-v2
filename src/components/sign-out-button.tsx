"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
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
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
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
