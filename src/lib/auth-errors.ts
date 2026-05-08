/**
 * Maps `?error=...` query params (set by /auth/callback when an email link
 * or OAuth handshake fails) to user-friendly messages shown on login
 * pages. Hides the technical PKCE / state-mismatch language Supabase
 * surfaces by default — those messages aren't actionable for end users.
 */
export function friendlyError(code: string | null): string | null {
  if (!code) return null;

  // Supabase OAuth PKCE / state errors all fall under one broad
  // family — "we lost your session between Google and us". The fix is
  // always the same from the user's perspective: try again in the
  // same browser. Match heuristically on the message we get back.
  const lower = code.toLowerCase();
  if (
    lower.includes("pkce") ||
    lower.includes("code verifier") ||
    lower.includes("invalid flow state") ||
    lower.includes("flow state has expired") ||
    lower.includes("state cookie") ||
    lower.includes("auth code")
  ) {
    return "Your sign-in session timed out before we could complete it. Please try Continue with Google again — same browser, same tab — and don't close it while you authenticate.";
  }

  switch (code) {
    case "link_expired":
      return "That confirmation link has expired or already been used. Please sign up again or request a new link.";
    case "missing_code":
      return "We couldn't read the confirmation code in that link. Please request a fresh one.";
    case "auth_failed":
      return "We couldn't verify that link. Please try signing in or request a new confirmation email.";
    default:
      // Fallback: surface Supabase's own error message verbatim
      return code;
  }
}
