"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell, AuthField, AuthSubmit } from "@/components/auth-shell";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { friendlyError } from "@/lib/auth-errors";

export default function AdminLoginPage() {
  // Wrap in Suspense — Next.js 16 requires it whenever a client component
  // calls useSearchParams, otherwise prerender fails the build.
  return (
    <Suspense>
      <AdminLoginInner />
    </Suspense>
  );
}

function AdminLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `next` is honoured for both admins and officers if explicitly set
  // (e.g. they bookmarked /admin/safety/[id] and got bounced to login).
  // Otherwise we route by role below — admins to the ops dashboard,
  // officers to their scoped safety queue.
  const nextParam = searchParams.get("next");
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(friendlyError(urlError));
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
      return;
    }

    // Verify the user has admin OR safety_officer role; otherwise sign
    // back out. Officers go to the safety queue, admins to the ops
    // dashboard — both live under /admin/* and share the same layout
    // which scopes the sidebar per role.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profile?.role !== "admin" && profile?.role !== "safety_officer") {
      await supabase.auth.signOut();
      setError("This account doesn't have admin or safety officer access.");
      setIsLoading(false);
      return;
    }

    const fallback =
      profile.role === "safety_officer" ? "/admin/safety" : "/admin";
    router.push(nextParam ?? fallback);
    router.refresh();
  };

  return (
    <AuthShell
      title="Staff sign in"
      subtitle="Operations console + safety officers — Rajlo staff only."
      audience="admin"
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-xl border border-rajlo-red/20 bg-primary-soft px-4 py-3 text-sm text-rajlo-red">
            {error}
          </div>
        )}

        <AuthField
          label="Email"
          type="email"
          placeholder="ops@rajlo.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          icon="email"
          required
        />
        <AuthField
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          icon="password"
          required
        />
        <div className="-mt-2 flex justify-end">
          <Link
            href="/auth/forgot-password"
            className="text-xs font-semibold text-rajlo-red hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <AuthSubmit onClick={handleLogin} loading={isLoading} disabled={!email || !password}>
          Sign in
        </AuthSubmit>
        <p className="text-center text-xs text-muted">
          Admin and safety-officer accounts are created by Rajlo. If you
          need access, contact the operations team.
        </p>
      </div>
    </AuthShell>
  );
}
