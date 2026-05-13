"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Icon, type IconName } from "./icons";
import { isNativeApp, haptics } from "@/lib/native";

/**
 * Native-style bottom tab bar for the driver Capacitor app. Lifts the
 * five most-used surfaces out of the hamburger drawer so reaching
 * them is one thumb-tap instead of a two-step menu.
 *
 * Shows ONLY inside the Capacitor app — on the web the existing
 * sidebar continues to be the navigation primitive. We also hide
 * the bar on auth pages and the verification-pending screen so it
 * doesn't appear before the driver is actually in the portal.
 *
 * The bar is fixed to the safe-area bottom so it sits above the
 * Android gesture indicator without overlapping. Pages need
 * `pb-24` (or use safe-area-inset-bottom padding) so their content
 * doesn't hide behind it — the layout below handles that.
 */

type Tab = {
  href: string;
  label: string;
  icon: IconName;
  /** Paths that should highlight this tab. The first entry is the
   *  click target; the rest are "also-considered-active" prefixes. */
  match: string[];
};

const DRIVER_TABS: Tab[] = [
  {
    href: "/driver",
    label: "Home",
    icon: "home",
    match: ["/driver", "/driver/requests"],
  },
  {
    href: "/driver/active-trip",
    label: "Trip",
    icon: "navigation",
    match: ["/driver/active-trip"],
  },
  {
    href: "/driver/earnings",
    label: "Earnings",
    icon: "trending-up",
    match: ["/driver/earnings", "/driver/wallet"],
  },
  {
    href: "/driver/history",
    label: "History",
    icon: "clock",
    match: ["/driver/history"],
  },
  {
    href: "/driver/profile",
    label: "Me",
    icon: "user",
    match: [
      "/driver/profile",
      "/driver/verification",
      "/driver/help-safety",
      "/driver/notifications",
    ],
  },
];

/** Routes where the bottom bar should NOT show even inside the app. */
const HIDDEN_PREFIXES = [
  "/auth/",
  "/driver/onboarding",
  "/driver/pending",
  "/driver/verify-on-web",
  "/driver/download-app",
  "/driver/resubmit",
  "/driver/renew",
  "/403",
  "/404",
];

function pickActiveTab(path: string): Tab | null {
  if (!path) return null;
  // Match longest prefix first so /driver/active-trip beats /driver.
  const sorted = [...DRIVER_TABS].sort(
    (a, b) =>
      Math.max(...b.match.map((m) => m.length)) -
      Math.max(...a.match.map((m) => m.length)),
  );
  for (const tab of sorted) {
    if (tab.match.some((m) => path === m || path.startsWith(`${m}/`))) {
      return tab;
    }
  }
  return null;
}

export function NativeBottomNav() {
  // Detect native context via useSyncExternalStore so we get a
  // proper SSR-safe initial value (`false`) and re-render once the
  // client knows the truth. This avoids React 19's
  // setState-in-effect lint rule.
  const native = useSyncExternalStore(
    () => () => {},
    () => isNativeApp(),
    () => false,
  );
  const pathname = usePathname() ?? "";

  const shouldShow =
    native &&
    pathname.startsWith("/driver") &&
    !HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));

  // Toggle a body attribute so a CSS rule in globals.css can add
  // matching bottom padding to pages — keeps scrollable content
  // from hiding behind the fixed bar.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (shouldShow) {
      document.body.dataset.rajloBottomNav = "1";
    } else {
      delete document.body.dataset.rajloBottomNav;
    }
    return () => {
      if (typeof document !== "undefined") {
        delete document.body.dataset.rajloBottomNav;
      }
    };
  }, [shouldShow]);

  if (!shouldShow) return null;

  const active = pickActiveTab(pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-lg"
      style={{
        paddingBottom:
          "max(env(safe-area-inset-bottom, 0px), 6px)",
      }}
      aria-label="Driver navigation"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around gap-1 px-2 pt-1">
        {DRIVER_TABS.map((tab) => {
          const isActive = active?.href === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                prefetch
                onClick={() => {
                  void haptics.tap();
                }}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-2 transition-colors ${
                  isActive
                    ? "text-rajlo-red"
                    : "text-muted active:bg-surface-soft"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  name={tab.icon}
                  className={`h-5 w-5 transition-transform ${
                    isActive ? "scale-110" : "scale-100"
                  }`}
                />
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isActive ? "text-rajlo-red" : "text-muted"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
