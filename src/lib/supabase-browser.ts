import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client for use in `"use client"` components.
 * Uses the public anon key (safe to expose) and reads/writes the auth session
 * to cookies via @supabase/ssr.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars",
    );
  }

  return createBrowserClient(url, anonKey);
}
