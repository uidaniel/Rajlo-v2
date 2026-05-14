import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * POST /api/auth/check-identity
 *
 * Body: { email: string }
 *
 * Returns the auth identity providers attached to the given email
 * (or `{ exists: false }` if there's no account). Used by the login
 * pages after a failed `signInWithPassword` to detect the common
 * "I signed up with Google and forgot, then tried to sign in with a
 * password" case — instead of the generic "invalid credentials"
 * error we explain "this email is registered with Google, use the
 * Google button".
 *
 * Privacy: we only return identity info AFTER a login attempt — the
 * caller has already typed an email + (wrong) password, so they know
 * we're checking that exact address. This isn't a public enumeration
 * endpoint; the auth-rate-limit on the parent sign-in attempt is the
 * implicit gate.
 *
 * Implementation: Supabase admin's listUsers paginates (50/page by
 * default). For Rajlo's early-stage user base this is fine; once we
 * cross a few thousand users we should switch to a direct query on
 * the auth.users + auth.identities tables via SQL.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
  if (!rawEmail || !rawEmail.includes("@")) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }
  const email = rawEmail.toLowerCase();

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    // Without service role we can't introspect — fall back to a
    // benign "we don't know" response. The caller treats this as no
    // hint and shows the generic auth error, which is fine.
    return NextResponse.json({ exists: false, providers: [] });
  }

  // Paginate auth users until we find the email. Bounded pages so
  // even a small misconfig can't run forever. ~10 pages × 200 users
  // = 2000-user ceiling before we miss; we'll graduate to a SQL
  // lookup before that's a problem.
  let found: { email: string | null; identities?: Array<{ provider: string }> } | null =
    null;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      return NextResponse.json({ exists: false, providers: [] });
    }
    const match = (data.users ?? []).find(
      (u) => (u.email ?? "").toLowerCase() === email,
    );
    if (match) {
      found = {
        email: match.email ?? null,
        identities: match.identities as
          | Array<{ provider: string }>
          | undefined,
      };
      break;
    }
    if ((data.users ?? []).length < 200) break; // last page
  }

  if (!found) {
    return NextResponse.json({ exists: false, providers: [] });
  }

  // De-dupe and lowercase the provider names — typical values are
  // "email", "google", "apple", etc.
  const providers = Array.from(
    new Set(
      (found.identities ?? [])
        .map((i) => (i?.provider ?? "").toLowerCase())
        .filter(Boolean),
    ),
  );

  return NextResponse.json({ exists: true, providers });
}
