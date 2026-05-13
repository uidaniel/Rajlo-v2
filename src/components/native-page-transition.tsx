"use client";

import { m, AnimatePresence } from "motion/react";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { isNativeApp } from "@/lib/native";

/**
 * Native-feel slide transition between pages. Only kicks in inside
 * the Capacitor app — on the web pages render instantly with no
 * animation overhead.
 *
 * Slides each new page in from the right by 16px while fading,
 * mimicking the iOS-style push transition that Android apps with a
 * Material-3 transition use. 180ms duration matches Android's
 * default "fast" emphasis duration so the app feels in-step with
 * the rest of the OS.
 */

export function NativePageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // SSR-safe boolean — useSyncExternalStore gives us the right
  // hydration semantics (server snapshot returns false) and avoids
  // React 19's setState-in-effect lint hit that a useState/useEffect
  // pair would trigger.
  const native = useSyncExternalStore(
    () => () => {},
    () => isNativeApp(),
    () => false,
  );

  if (!native) {
    // Web path — render children directly, no animation wrapper, no
    // AnimatePresence overhead. Page transitions on the web feel
    // forced and clash with how regular sites behave.
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
