"use client";

import { LazyMotion, domAnimation, MotionConfig } from "motion/react";

/**
 * Top-level wrapper for Motion animations.
 *
 * - LazyMotion + domAnimation: trims bundle size by ~30KB by lazy-loading only
 *   the dom-animation features we use (no drag, no layout shifts, no svg).
 * - MotionConfig reducedMotion="user": automatically disables non-essential
 *   transitions for users with `prefers-reduced-motion: reduce` set in their OS.
 *
 * Renders no DOM of its own, so it's safe to wrap server-rendered content.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
