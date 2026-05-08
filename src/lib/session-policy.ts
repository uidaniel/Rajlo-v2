/**
 * Session-policy helper — controls how long a signed-in session
 * persists across page reloads and browser restarts.
 *
 * Supabase's refresh token already lives ~7 days by default, so a
 * signed-in user is technically "logged in" for 7 days regardless. The
 * helper here adds a *client-side* expiry on top:
 *
 *   - "remember" (default after sign-in): expiry = NOW + 7 days
 *   - "session-only": expiry = NOW + 8 hours (covers a typical day's
 *     usage but the user gets bumped out by the next morning)
 *
 * `<SessionGuard>` reads the expiry on every portal page load and
 * signs the user out if it's in the past. The signOut hook clears the
 * stamp so a stale value can't kick a freshly-logged-in user.
 *
 * Stored in localStorage so it survives tab close. The key is
 * deliberately namespaced under `rajlo:` so it's easy to spot in
 * DevTools and won't collide with anything else we save.
 */

const KEY = "rajlo:session-expiry";
const REMEMBER_DAYS = 7;
const SESSION_HOURS = 8;

export type Persistence = "remember" | "session-only";

export function setSessionPolicy(p: Persistence): void {
  if (typeof window === "undefined") return;
  const ms =
    p === "remember"
      ? REMEMBER_DAYS * 24 * 60 * 60 * 1000
      : SESSION_HOURS * 60 * 60 * 1000;
  try {
    window.localStorage.setItem(KEY, String(Date.now() + ms));
  } catch {
    /* private browsing or storage quota — silently ignore */
  }
}

export function clearSessionPolicy(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Returns true if a session-policy stamp exists AND is in the past.
 *  Returns false when no stamp is set (treat as "no client-side
 *  expiry policy active — defer to Supabase's session lifetime"). */
export function isSessionExpired(): boolean {
  if (typeof window === "undefined") return false;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  const expiry = Number(raw);
  if (!Number.isFinite(expiry)) return false;
  return Date.now() > expiry;
}

/** Returns the stamp expiry as a Date, or null when no stamp set. */
export function getSessionExpiry(): Date | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  const expiry = Number(raw);
  if (!Number.isFinite(expiry)) return null;
  return new Date(expiry);
}
