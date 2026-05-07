import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the auth session cookie on every request and gates protected
 * portals.
 *
 * Routes:
 *   /rider/*          requires any logged-in user (defaults to rider portal)
 *   /driver/*         requires logged-in user
 *   /admin/*          requires logged-in user with role='admin'
 *
 * Anonymous visitors get bounced to the matching login page; logged-in users
 * who try to access a portal that doesn't match their role get redirected to
 * a 403 page.
 *
 * Static assets, API routes, and public marketing pages are not gated.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session if expired and exposes the user.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const isAdminRoute = path.startsWith("/admin");
  const isDriverRoute =
    path.startsWith("/driver") && path !== "/driver-join";
  const isRiderRoute = path.startsWith("/rider");
  const isProtected = isAdminRoute || isDriverRoute || isRiderRoute;

  if (!isProtected) return response;

  // Anonymous visitor → bounce to the appropriate login page.
  if (!user) {
    const loginPath = isAdminRoute
      ? "/auth/admin/login"
      : isDriverRoute
        ? "/auth/driver/login"
        : "/auth/rider/login";
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Logged-in: check role for portal gating.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "rider";

  // Strict role separation — each portal is reserved for its role.
  // (Admins access /admin only; if you want admin to peek into other portals,
  // grant a separate "support" role and gate that here.)
  if (
    (isAdminRoute && role !== "admin") ||
    (isDriverRoute && role !== "driver") ||
    (isRiderRoute && role !== "rider")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/403";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Match everything except: Next internals, static assets, fonts, images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)$).*)",
  ],
};
