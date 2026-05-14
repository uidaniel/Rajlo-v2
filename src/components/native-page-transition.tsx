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
 * Direction-aware: on a forward navigation (link tap, router.push)
 * the new page slides in from the right while the old slides out
 * left, mimicking the iOS-style push. On a **back** navigation
 * (Android hardware back, our in-page back button, browser back —
 * anything that fires `popstate`) the direction reverses: the current
 * page slides out to the **right**, revealing the previous page
 * sliding in from the left. That matches what every native Android
 * app does and is what the driver flagged was missing.
 *
 * Also skips animation entirely for top-tab → top-tab navigation
 * (Home ↔ Earnings ↔ History ↔ Me etc.) so tab swaps feel instant.
 */

/** Top-level tab paths whose mutual transitions should be instant. */
const TOP_TAB_PATHS = new Set([
  "/driver",
  "/driver/active-trip",
  "/driver/earnings",
  "/driver/history",
  "/driver/profile",
]);

/** Slide offset in px — small enough to feel like a polish detail,
 *  big enough that the motion direction reads clearly. */
const SLIDE_PX = 20;

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

  // Direction snapshot for the *next* navigation. Popstate (Android
  // hardware back, browser back, router.back()) flips it to -1; every
  // other navigation leaves it at +1 (forward push). The ref avoids
  // an extra render and the value is read at the moment AnimatePresence
  // captures props for the exiting child, then reset back to +1 once
  // pathname settles so the next forward push reads correctly.
  const directionRef = useRef<1 | -1>(1);

  useEffect(() => {
    const onPopState = () => {
      directionRef.current = -1;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Remember the previous pathname so we can detect tab-to-tab moves.
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    prevPathnameRef.current = pathname;
    // Reset direction now that the new page is committed. The
    // AnimatePresence + custom prop has already snapshotted the
    // direction value used for this transition.
    directionRef.current = 1;
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

  // Direction-aware variants. `custom` propagates through AnimatePresence
  // to the exiting child too, so the OUTGOING page sees the latest
  // direction value (not the value at its original mount).
  const variants = {
    initial: (dir: 1 | -1) => ({ opacity: 0, x: SLIDE_PX * dir }),
    animate: { opacity: 1, x: 0 },
    exit: (dir: 1 | -1) => ({ opacity: 0, x: -SLIDE_PX * dir }),
  };

  return (
    <AnimatePresence mode="wait" initial={false} custom={directionRef.current}>
      <m.div
        key={pathname}
        custom={directionRef.current}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
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
