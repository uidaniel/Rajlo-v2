"use client";

import { m, AnimatePresence } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { isNativeApp } from "@/lib/native";

/**
 * Native-feel slide transition between pages. Only kicks in inside
 * the Capacitor app — on the web pages render instantly with no
 * animation overhead.
 *
 * **Skips animation for top-tab → top-tab navigation** (e.g. tapping
 * Home → Earnings). Tabs in a real Android app cut instantly between
 * sibling screens; the slide-fade only feels right when pushing into
 * a deeper page (drawer item, detail screen). Animating tab swaps was
 * also what produced the perceived layout shift and the "still
 * loading" flash the driver flagged — the page was fading in over
 * 180ms whether the data was cached or not.
 *
 * For deeper navigation it slides each new page in from the right by
 * 16px while fading, mimicking the iOS-style push transition that
 * Material 3 also uses. 180ms duration matches Android's default
 * "fast" emphasis duration so the app feels in-step with the OS.
 */

/** Top-level tab paths whose mutual transitions should be instant. */
const TOP_TAB_PATHS = new Set([
  "/driver",
  "/driver/active-trip",
  "/driver/earnings",
  "/driver/history",
  "/driver/profile",
]);

export function NativePageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";

  // SSR-safe boolean — useSyncExternalStore gives us the right
  // hydration semantics (server snapshot returns false) and avoids
  // React 19's setState-in-effect lint hit that a useState/useEffect
  // pair would trigger.
  const native = useSyncExternalStore(
    () => () => {},
    () => isNativeApp(),
    () => false,
  );

  // Remember the previous pathname so we can detect tab-to-tab moves.
  // We update the ref AFTER render so the comparison on the current
  // render reads the just-changed-from value.
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    prevPathnameRef.current = pathname;
  }, [pathname]);

  if (!native) {
    // Web path — render children directly, no animation wrapper, no
    // AnimatePresence overhead. Page transitions on the web feel
    // forced and clash with how regular sites behave.
    return <>{children}</>;
  }

  const prevPath = prevPathnameRef.current;
  const tabToTab =
    TOP_TAB_PATHS.has(prevPath) &&
    TOP_TAB_PATHS.has(pathname) &&
    prevPath !== pathname;

  if (tabToTab) {
    // Instant swap between bottom-nav tabs — no slide, no fade. The
    // bottom tab bar stays still and the new page snaps in.
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={pathname}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{
          duration: 0.18,
          ease: [0.4, 0, 0.2, 1], // material emphasized-easing
        }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}
