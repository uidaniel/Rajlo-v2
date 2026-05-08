"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { ArcWatermark } from "./arc-pattern";
import { Icon, type IconName } from "./icons";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type NavLink = {
  label: string;
  href: string;
  icon: IconName;
};

type MobileDrawerProps = {
  title: string;
  subtitle: string;
  nav: NavLink[];
  children: React.ReactNode;
};

/**
 * Dark sidebar with brand-red accents on the active item + user profile
 * footer with sign-out. Used by all rider/driver/admin portal pages.
 *
 * Why dark, not red: the sidebar is on-screen all day, so a neutral chrome
 * keeps the main content (which uses red for CTAs and badges) actually
 * legible. Red is reserved for the active nav item, the chevron, and a
 * faint corner bloom for brand presence.
 *
 * Layout: fixed-width sidebar on the left (md+), drawer overlay on mobile.
 */
export function MobileDrawer({
  // title + subtitle accepted for backward compat with PortalLayout's props,
  // but no longer rendered — Logo at top is enough chrome.
  title: _title,
  subtitle: _subtitle,
  nav,
  children,
}: MobileDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<{
    full_name: string | null;
    email: string | null;
    role: string | null;
    avatar_url: string | null;
  } | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Fetch the signed-in user's profile for the footer block.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, role, avatar_url")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      // Prefer the profile's avatar_url (synced by trigger), but fall back to
      // user_metadata.avatar_url so the picture appears immediately on the
      // very first OAuth sign-in (before the next page load picks up the row).
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const metaAvatar =
        (typeof meta.avatar_url === "string" ? meta.avatar_url : null) ??
        (typeof meta.picture === "string" ? meta.picture : null);
      setProfile({
        full_name: data?.full_name ?? null,
        email: user.email ?? null,
        role: data?.role ?? null,
        avatar_url: data?.avatar_url ?? metaAvatar ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    // Capture role BEFORE signOut so we know which login page to bounce to.
    const role = profile?.role ?? "rider";
    await supabase.auth.signOut();
    const loginPath =
      role === "admin"
        ? "/auth/admin/login"
        : role === "driver"
          ? "/auth/driver/login"
          : "/auth/rider/login";
    router.push(loginPath);
    router.refresh();
  };

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join("")
    : (profile?.email?.[0]?.toUpperCase() ?? "·");

  // Pick the active nav item by longest matching href. Stops the root
  // "/rider" Dashboard link from showing as active on every nested page —
  // on /rider/request only "Request a ride" lights up, etc.
  const activeHref = nav.reduce<string | null>((longest, item) => {
    const matches =
      pathname === item.href || pathname?.startsWith(`${item.href}/`);
    if (!matches) return longest;
    if (!longest || item.href.length > longest.length) return item.href;
    return longest;
  }, null);

  // Lock body scroll while the mobile drawer is open. Without this, a
  // swipe on the backdrop scrolls the page underneath, which makes the
  // drawer feel like it's not even open. Also kills the iOS rubber-band
  // bounce on the visible area outside the drawer.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  return (
    // Lock the desktop layout to viewport height + clip overflow so only the
    // <main> below can scroll. Sidebar stays put in its grid cell, page
    // doesn't scroll at the body level.
    <div className="min-h-screen bg-background md:grid md:h-screen md:grid-cols-[280px_1fr] md:overflow-hidden">
      {/* ============== Mobile top bar ============== */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3 md:hidden">
        <Logo size="sm" tagline />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-soft hover:bg-surface"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
        >
          <Icon name={isOpen ? "x" : "menu"} className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile backdrop. `top-14` keeps the navbar tappable so the close
         button still works; `bottom-0` + h-auto pin to the actually-
         visible area. `touch-none` makes sure swipes on the backdrop
         don't pass through and scroll content underneath — body
         overflow is also locked via the effect below as a backup. */}
      {isOpen && (
        <button
          aria-hidden
          tabIndex={-1}
          className="fixed inset-x-0 bottom-0 top-14 z-30 touch-none bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ============== Sidebar ==============
         Mobile: pinned below the top bar (top-14 = 3.5rem) and sized
         with `100dvh` (dynamic viewport height) so the iOS URL bar
         doesn't push the footer off-screen. `100vh` would *over*-size
         the drawer because vh includes the URL-bar slot even when
         it's hidden — dvh tracks the actually-visible area.
         Desktop: takes the full viewport in its grid cell. */}
      <aside
        className={`fixed left-0 top-14 z-40 flex h-[calc(100dvh-3.5rem)] w-72 flex-col overflow-hidden text-white shadow-2xl transition-transform md:static md:top-0 md:h-screen md:w-auto md:translate-x-0 md:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          // Premium dark surface: a faint white glaze at the very top for that
          // glassy SaaS feel, a warm-to-deep gradient body, and a soft red
          // bloom in the bottom-right corner so the brand still whispers.
          background:
            "radial-gradient(circle at 100% 100%, rgba(241,1,0,0.18) 0%, rgba(241,1,0,0) 38%), linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 24%), linear-gradient(165deg, #1a1d10 0%, #111906 55%, #07090a 100%)",
        }}
      >
        {/* Top: Logo only — portal title/subtitle removed for cleaner chrome. */}
        <div className="relative hidden border-b border-white/10 px-6 pb-5 pt-7 md:block">
          <Logo size="sm" variant="white" tagline />
        </div>

        {/* Nav with icons + active state. Hidden scrollbar — still scrollable
            for very long nav lists, just no visible scrollbar.
            `min-h-0` is the canonical fix for "flex child should scroll":
            without it, the flex item won't shrink below its content's
            intrinsic height, so `overflow-y-auto` never triggers and
            the OUTER page scrolls instead of the nav. */}
        <nav
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-4 [&::-webkit-scrollbar]:hidden md:pt-5"
          style={{ scrollbarWidth: "none" }}
          aria-label="Portal navigation"
        >
          <ul className="grid gap-1">
            {nav.map((item) => {
              const active = item.href === activeHref;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                      active
                        ? "bg-white text-rajlo-red shadow-md shadow-black/10"
                        : "text-white/85 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-lg transition-colors ${
                        active
                          ? "bg-primary-soft text-rajlo-red"
                          : "bg-white/10 text-white/90"
                      }`}
                    >
                      <Icon name={item.icon} className="h-4 w-4" />
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {active && (
                      <Icon
                        name="chevron-right"
                        className="h-3.5 w-3.5 text-rajlo-red"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User profile + sign out */}
        <div className="relative border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3 backdrop-blur">
            <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white/20 text-sm font-bold uppercase ring-1 ring-white/15">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {profile?.full_name ?? "Loading…"}
              </p>
              <p className="truncate text-[11px] text-white/70">
                {profile?.email ?? ""}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <Icon name="log-out" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ============== Main content ============== */}
      <main className="relative overflow-x-hidden pb-20 md:overflow-y-auto md:pb-0">
        {children}
      </main>
    </div>
  );
}
