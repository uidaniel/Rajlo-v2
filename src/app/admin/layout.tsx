import { redirect } from "next/navigation";
import { PortalLayout } from "@/components/portal-layout";
import { adminNav, safetyOfficerNav } from "@/lib/mock-data";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * Admin / officer portal shell.
 *
 * Both `admin` and `safety_officer` roles route through this layout —
 * officers need access to the safety queue + live trips, which live
 * under /admin/* alongside the full ops console. We branch on the
 * authenticated user's profile.role so officers only see the scoped
 * nav (Safety + Live trips) and don't even render the rest of the
 * admin sidebar that they wouldn't have permission for at the API
 * layer anyway.
 *
 * Anyone else hitting /admin gets bounced to /sign-in (no auth) or
 * the rider dashboard (signed in but wrong role).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in?from=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  if (role !== "admin" && role !== "safety_officer") {
    redirect("/rider");
  }

  const isAdmin = role === "admin";

  return (
    <PortalLayout
      title={isAdmin ? "Admin/Ops Portal" : "Safety Operations"}
      subtitle={
        isAdmin
          ? "Verification operations, pricing controls, and incident workflows."
          : "Safety queue, live trips, and rider chat — scoped to safety scope."
      }
      nav={isAdmin ? adminNav : safetyOfficerNav}
    >
      {children}
    </PortalLayout>
  );
}
