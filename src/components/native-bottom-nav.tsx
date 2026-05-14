"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Icon, type IconName } from "./icons";
import { isNativeApp } from "@/lib/native";
import {
  DRIVER_PREFETCH_URLS,
  prefetchDriverData,
} from "@/lib/driver-prefetch";

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

/** Hrefs of the tabs above — exported so MobileDrawer can hide them
 *  from the native drawer (the bottom bar already covers them) and
 *  so the drawer's back-button-vs-hamburger logic can branch on it. */
export const NATIVE_DRIVER_TAB_HREFS = new Set(
  DRIVER_TABS.map((tab) => tab.href),
);

/** True when `pathname` is one of the five top-level tab routes. The
 *  bottom bar should ONLY render on these; drawer items and deeper
 *  pages (history detail, wallet, route taxi, etc.) get a full-bleed
 *  page with an in-page back button instead. */
export function isTopTabPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return NATIVE_DRIVER_TAB_HREFS.has(pathname);
}

/**
 * Pick the active tab by **longest matching prefix across all tabs**.
 *
 * The earlier "longest tab.match max length" sort was buggy: it picked
 * the Home tab for /driver/earnings because Home's max prefix length
 * (16 — "/driver/requests") tied with Earnings's max (16 —
 * "/driver/earnings"), and the loop's first-match-wins order made Home
 * win via its "/driver" catch-all. Comparing the actually-matched
 * prefix's length per tab fixes that — Earnings's "/driver/earnings"
 * (16 chars) beats Home's "/driver" (7 chars) cleanly.
 */
function pickActiveTab(path: string): Tab | null {
  if (!path) return null;
  let bestTab: Tab | null = null;
  let bestLen = -1;
  for (const tab of DRIVER_TABS) {
    for (const prefix of tab.match) {
      const matches =
        path === prefix || path.startsWith(`${prefix}/`);
      if (matches && prefix.length > bestLen) {
        bestLen = prefix.length;
        bestTab = tab;
      }
    }
  }
  return bestTab;
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

  // Bottom bar only appears on the five top-level tab paths. Drawer
  // items (Wallet, Route Taxi, Notifications, etc.) and deep details
  // pages render full-bleed without the bar — they're "pushed views"
  // in native-app terms and get a back button in the top chrome.
  const shouldShow = native && isTopTabPath(pathname);

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

  // Warm the common driver endpoints the moment the bar appears, so
  // the first tab-tap from launch lands on cached data instead of a
  // skeleton. We used to schedule via requestIdleCallback for politeness
  // but on Android that idle frame can be 300–500ms out, which was long
  // enough that a quick tap beat the prefetch — the cache then read
  // empty and the page fell through to its skeleton.
  useEffect(() => {
    if (!shouldShow) return;
    for (const url of DRIVER_PREFETCH_URLS) {
      void prefetchDriverData(url);
    }
  }, [shouldShow]);

  if (!shouldShow) return null;

  const active = pickActiveTab(pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-lg"
      style={{
        // Pin to the visible viewport bottom on Android WebView too.
        // The `translateZ(0)` promotes the bar to its own compositor
        // layer so the WebView never paints it inline with the
        // scrolling content — what was making it feel jittery on
        // tab change. `will-change: transform` keeps the layer warm.
        bottom: 0,
        left: 0,
        right: 0,
        transform: "translateZ(0)",
        willChange: "transform",
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
                  // Warm the destination tab's data on tap so the next
                  // page hits the cache instead of fetching cold. No
                  // haptic feedback — the driver flagged the vibration
                  // on every tab tap as noisy.
                  for (const url of DRIVER_PREFETCH_URLS) {
                    void prefetchDriverData(url);
                  }
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
