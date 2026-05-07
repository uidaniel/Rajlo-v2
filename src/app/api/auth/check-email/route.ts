import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * POST /api/auth/check-email
 * Body: { email: string }
 * Returns: { exists: boolean, role?: 'rider' | 'driver' | 'admin' }
 *
 * Used by signup forms to pre-check whether an email is already registered
 * (in any role) before calling supabase.auth.signUp(). Prevents the surprise
 * Supabase behavior where signUp on an existing-but-unconfirmed account
 * silently re-sends a confirmation rather than returning an error.
 *
 * Uses the service_role admin client; the anon key cannot list auth users.
 *
 * Note: pulls the first 1000 users (sufficient for the Phase 1 pilot). If
 * we grow past that, swap to a `check_email_exists` RPC function.
 */
export async function POST(request: NextRequest) {
  let email: unknown;
  try {
    const body = await request.json();
    email = body?.email;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    // No Supabase configured (dev fallback) — let signup proceed.
    return NextResponse.json({ exists: false });
  }

  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const found = data.users.find(
    (u) => u.email?.toLowerCase() === normalized,
  );

  if (!found) {
    return NextResponse.json({ exists: false });
  }

  // Look up the role on the matching profile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", found.id)
    .single();

  return NextResponse.json({
    exists: true,
    role: (profile?.role as "rider" | "driver" | "admin" | undefined) ?? "rider",
  });
}
