import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Request-scoped server Supabase client for use in:
 *   - Server Components (pages, layouts)
 *   - Server Actions
 *   - Route Handlers (app/api/*)
 *
 * Reads/writes the auth session cookies through Next.js' cookie store, so
 * `supabase.auth.getUser()` correctly returns the logged-in user.
 *
 * NOTE: This client uses the public anon key and respects RLS. For admin
 * operations that need to bypass RLS, use `getSupabaseServerClient()` from
 * `./supabase-server.ts` (service_role key).
 */
export async function createSupabaseAuthServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // setAll may throw if called from a Server Component (read-only).
        // In that case, the cookies will be refreshed on the next request via
        // middleware — safe to swallow here.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* read-only context */
        }
      },
    },
  });
}
