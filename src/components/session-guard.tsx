"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  clearSessionPolicy,
  getSessionExpiry,
  isSessionExpired,
  setSessionPolicy,
} from "@/lib/session-policy";

/**
 * Mount once inside each portal layout (rider, driver). On every page
 * load it:
 *   1. Signs the user out + bounces to "/" if the client-side
 *      session-policy stamp has elapsed.
 *   2. Stamps a default 7-day expiry when the user is signed in but
 *      no stamp exists yet (covers Google OAuth + post-signup
 *      confirmation paths, where there's no login form to set the
 *      stamp explicitly).
 *
 * Renders nothing — purely side-effect.
 *
 * Why client-side AND server-side:
 *   - Supabase's refresh-token lifetime keeps a session technically
 *     valid for ~7 days by default, regardless of any client policy.
 *   - This component layers a UI-controlled expiry on top so users
 *     who unchecked "Stay signed in for 7 days" actually get a
 *     shorter session. Without it, the checkbox would be a lie.
 */
export function SessionGuard() {
  useEffect(() => {
    if (isSessionExpired()) {
      const supabase = createSupabaseBrowserClient();
      void supabase.auth.signOut().finally(() => {
        clearSessionPolicy();
        // Hard reload to flush any cached Supabase session cookies +
        // route the user back to the unauthenticated home page.
        window.location.href = "/";
      });
      return;
    }

    // No stamp yet — this happens for OAuth / post-signup users who
    // never went through a login form with the "remember" checkbox.
    // We default them to the same 7-day window the checkbox sets.
    if (!getSessionExpiry()) {
      setSessionPolicy("remember");
    }
  }, []);
  return null;
}
