"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Tiny GSAP scaffolding used across the landing page. Pulls the
 * ScrollTrigger plugin in once, exposes a `useGsap` hook that scopes
 * `gsap.context` to a ref so animations clean up on unmount, and a
 * `prefersReducedMotion` reader that lets every section skip flashy
 * effects for users who've opted out at the OS level.
 *
 * Why centralise: every landing section uses the same setup pattern
 * (ref + context + cleanup), so one helper keeps each section file
 * focused on the actual animation choreography rather than the
 * boilerplate.
 */

// GSAP de-dupes registerPlugin internally, so calling this at module
// load is safe even if multiple imports trigger it.
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };

/** True when the OS-level "reduce motion" pref is on. SSR-safe (returns false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Run a GSAP setup function inside a `gsap.context()` scoped to a ref.
 * Cleanup runs on unmount automatically — no leftover ScrollTriggers
 * or live animations after navigation away from the landing.
 *
 *   const ref = useGsap<HTMLDivElement>((root) => {
 *     gsap.from(root.querySelector(".title"), { y: 40, opacity: 0 });
 *   });
 *   return <div ref={ref}>...</div>;
 *
 * NOTE on the API: we deliberately do NOT pass the `gsap.Context` into
 * the setup callback. `gsap.context()` invokes the callback synchronously
 * during its own initialisation, so any closure that references the
 * outer `ctx` const hits a TDZ error ("Cannot access 'X' before
 * initialization") in production builds where minifiers can't rescue
 * it. Animations created inside the callback are auto-scoped to the
 * context regardless, so the param wasn't earning its keep.
 */
export function useGsap<T extends HTMLElement = HTMLDivElement>(
  setup: (root: T) => void,
  deps: ReadonlyArray<unknown> = [],
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => setup(root), root);

    // ScrollTrigger calculates trigger positions from the DOM the
    // moment each `gsap.to/from(... scrollTrigger: ...)` is created.
    // If fonts load late, images settle, or any other layout shift
    // happens after that, every cached position is stale and the
    // triggers can silently miss their start point — sections never
    // animate in, content stays at opacity 0.
    //
    // We force a refresh after mount, again on the next frame (post
    // hydration paint), and one more time once webfonts settle. Each
    // refresh is cheap — ScrollTrigger debounces internally.
    const refreshSoon = () => ScrollTrigger.refresh();
    const raf = requestAnimationFrame(refreshSoon);
    const t1 = window.setTimeout(refreshSoon, 250);
    const fontsReady =
      typeof document !== "undefined" && "fonts" in document
        ? (document.fonts as FontFaceSet).ready.then(refreshSoon).catch(() => null)
        : null;
    void fontsReady;

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      ctx.revert();
    };
    // The setup callback identity is intentionally ignored — callers
    // pass an inline function on every render, but the actual deps
    // they care about live in the `deps` array below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
