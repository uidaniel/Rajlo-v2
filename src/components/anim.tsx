"use client";

import {
  m,
  useInView,
  useMotionValue,
  useSpring,
  animate,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/* ────────────────────────────────────────────────
 * Performance discipline:
 *   - All animations animate only `transform` and `opacity` (GPU-accelerated).
 *   - Every scroll-triggered animation uses `viewport={{ once: true }}` so
 *     they run exactly once per page load.
 *   - `useReducedMotion()` from motion/react returns true if the user has
 *     `prefers-reduced-motion: reduce` — we shorten/omit motion in that case.
 *   - We keep durations under 800ms.
 * ──────────────────────────────────────────────── */

const easing = [0.22, 1, 0.36, 1] as const; // smooth easeOutCubic

/* ─────────── FadeUp ─────────── */

type FadeUpProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** Pixels to translate from. Defaults to 24. */
  y?: number;
  as?: "div" | "section" | "header" | "p" | "h1" | "h2" | "h3" | "li" | "span";
};

/** Fades and slides up when scrolled into view. */
export function FadeUp({
  children,
  delay = 0,
  className,
  y = 24,
  as = "div",
}: FadeUpProps) {
  const reduced = useReducedMotion();
  const Tag = m[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: reduced ? 0.01 : 0.6, delay, ease: easing }}
    >
      {children}
    </Tag>
  );
}

/* ─────────── Stagger ─────────── */

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easing } },
};

/** Parent that triggers staggered children when scrolled into view. */
export function Stagger({
  children,
  className,
  amount = 0.2,
}: {
  children: ReactNode;
  className?: string;
  amount?: number;
}) {
  return (
    <m.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </m.div>
  );
}

/** Direct child of Stagger — animates as part of the stagger. */
export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "p" | "span";
}) {
  const Tag = m[as];
  return (
    <Tag className={className} variants={staggerItem}>
      {children}
    </Tag>
  );
}

/* ─────────── CountUp ─────────── */

/**
 * Animated number counter — when scrolled into view, eases from 0 to `to`.
 * Pass `prefix`/`suffix` for things like "JMD" or "+", and `decimals` for floats.
 * Plain text like "100%" or "1–4" should bypass this and just be rendered as-is.
 */
export function CountUp({
  to,
  duration = 1.4,
  prefix = "",
  suffix = "",
  className,
}: {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "0px 0px -100px 0px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplay(to);
      return;
    }
    const controls = animate(0, to, {
      duration,
      ease: easing,
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [inView, to, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ─────────── FloatY ─────────── */

/** Gentle continuous float for hero phone mockups. ~3s cycle, ±6px. */
export function FloatY({
  children,
  amplitude = 6,
  duration = 3.8,
  delay = 0,
  rotate = 0,
  className,
}: {
  children: ReactNode;
  amplitude?: number;
  duration?: number;
  delay?: number;
  rotate?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <div className={className} style={{ transform: `rotate(${rotate}deg)` }}>
        {children}
      </div>
    );
  }
  return (
    <m.div
      className={className}
      style={{ rotate, willChange: "transform" }}
      animate={{ y: [-amplitude, amplitude, -amplitude] }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </m.div>
  );
}

/* ─────────── WordReveal ─────────── */

/** Splits text by words and reveals each from below — used on hero headline. */
export function WordReveal({
  text,
  className,
  as = "span",
  delay = 0,
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "span" | "p";
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const Tag = m[as];
  const words = text.split(" ");

  if (reduced) {
    const Static = as as keyof React.JSX.IntrinsicElements;
    return <Static className={className}>{text}</Static>;
  }

  return (
    <Tag
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        show: { transition: { staggerChildren: 0.08, delayChildren: delay } },
      }}
    >
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <m.span
            className="inline-block"
            variants={{
              hidden: { y: "110%" },
              show: { y: 0, transition: { duration: 0.7, ease: easing } },
            }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </m.span>
        </span>
      ))}
    </Tag>
  );
}

/* ─────────── HoverLift ─────────── */

/** Hover wrapper — lifts + adds shadow. Drop-in replacement for plain divs in cards. */
export function HoverLift({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
    >
      {children}
    </m.div>
  );
}

/* ─────────── ParallaxFloat ─────────── */

/**
 * Subtle 3D-tilt effect for hero phone mockups — tilts based on cursor position.
 * Mobile / no-pointer devices fall back to a static render.
 */
export function ParallaxFloat({
  children,
  className,
  intensity = 8,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 120, damping: 20 });
  const sy = useSpring(y, { stiffness: 120, damping: 20 });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(px * intensity);
    y.set(py * intensity);
  }

  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <m.div
      ref={ref}
      className={className}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
    >
      {children}
    </m.div>
  );
}
