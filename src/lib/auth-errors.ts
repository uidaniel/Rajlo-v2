/**
 * Maps `?error=...` query params (set by /auth/callback when an email link
 * fails) to user-friendly messages shown on login pages.
 */
export function friendlyError(code: string | null): string | null {
  if (!code) return null;

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
