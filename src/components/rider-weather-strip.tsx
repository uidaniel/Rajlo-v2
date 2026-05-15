"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, m } from "motion/react";
import { Icon } from "./icons";

// Shared expand/collapse curve. outQuart — starts moving quickly, eases
// into a long silky tail at the end. The exact curve Apple uses for
// system-level expand/collapse panels; gives the whole strip that
// liquid "settling into place" feel rather than a snappy linear pop.
const SMOOTH_DURATION = 0.55;
const SMOOTH_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SMOOTH_CSS = `cubic-bezier(0.22, 1, 0.36, 1)`;
const SMOOTH_CSS_DURATION = "550ms";

/**
 * Weather hero strip for the rider booking page.
 *
 * Compact-by-default — shows a real emoji + temperature + the short
 * condition label, with a chevron on the right that expands a panel
 * containing the witty quip ("Rainy day — grab your umbrella"). The
 * collapsed state keeps the page header tight; the expanded state
 * adds the playful copy when the rider taps to see more.
 *
 * Each condition also has its own motion layer (drifting orbs, rain
 * streaks, lightning flashes, etc.) so even the compact card feels
 * alive instead of static. Gradients are saturated enough that the
 * white text stays readable on every condition.
 *
 * Renders nothing if location permission was denied or the upstream
 * weather service is unreachable — the booking page sits flush
 * against the top in that case.
 */

type Condition =
  | "clear"
  | "cloudy"
  | "rain"
  | "thunderstorm"
  | "fog"
  | "snow";

type Weather = {
  tempC: number;
  tempF: number;
  apparentC: number | null;
  condition: Condition;
  isDay: boolean;
  description: string;
  witty: string;
};

const EMOJI: Record<Condition, string> = {
  clear: "☀️",
  cloudy: "⛅",
  rain: "🌧️",
  thunderstorm: "⛈️",
  fog: "🌫️",
  snow: "❄️",
};

// Saturated gradients so the white text always reads cleanly.
const GRADIENT: Record<Condition, string> = {
  clear:
    "linear-gradient(135deg, #b45309 0%, #d97706 50%, #92400e 100%)",
  cloudy:
    "linear-gradient(135deg, #1e293b 0%, #334155 55%, #475569 100%)",
  rain:
    "linear-gradient(135deg, #0c4a6e 0%, #075985 55%, #0e7490 100%)",
  thunderstorm:
    "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
  fog:
    "linear-gradient(135deg, #334155 0%, #475569 55%, #64748b 100%)",
  snow:
    "linear-gradient(135deg, #1e3a8a 0%, #1e40af 55%, #2563eb 100%)",
};

const ACCENT: Record<Condition, string> = {
  clear: "#fcd34d",
  cloudy: "#94a3b8",
  rain: "#7dd3fc",
  thunderstorm: "#fbbf24",
  fog: "#cbd5e1",
  snow: "#dbeafe",
};

export function RiderWeatherStrip() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [denied, setDenied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return;
        try {
          const res = await fetch(
            `/api/weather?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`,
          );
          if (!res.ok) return;
          const json = (await res.json()) as Weather;
          if (!cancelled) setWeather(json);
        } catch {
          /* silent */
        }
      },
      () => {
        if (!cancelled) setDenied(true);
      },
      { enableHighAccuracy: false, maximumAge: 30 * 60_000, timeout: 6_000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (!weather || denied) return null;

  return (
    // Single source of timing truth. Every nested `m.*` (the inner
    // layout flex row, the chevron rotate, etc.) inherits this curve
    // unless it overrides — so when the user taps, all the moving
    // parts (padding, emoji size, font size, tile size, height of the
    // witty panel) sweep along the same outQuart curve in lockstep
    // instead of each motion element using its own default.
    <MotionConfig
      transition={{ duration: SMOOTH_DURATION, ease: SMOOTH_EASE }}
    >
    <m.button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      // `layout` makes motion animate the height change automatically
      // when the witty-line panel slides in or out — no manual
      // measuring of the expanded height required.
      layout
      style={{
        background: GRADIENT[weather.condition],
        // CSS-property transition for `padding`, matched to the motion
        // duration + curve so the box smoothly inflates/deflates around
        // the content rather than snapping in two steps.
        transitionProperty: "padding",
        transitionDuration: SMOOTH_CSS_DURATION,
        transitionTimingFunction: SMOOTH_CSS,
        // Hint the compositor we're about to repaint geometry so the
        // first frame doesn't hiccup.
        willChange: "padding, transform, height",
      }}
      className={`relative block w-full cursor-pointer overflow-hidden rounded-2xl text-left text-white shadow-lg ${
        expanded ? "p-5" : "p-3"
      }`}
    >
      {/* Condition-specific motion layer. Lives behind the content at
         low opacity so it never competes with legibility. */}
      <ConditionMotion
        condition={weather.condition}
        accent={ACCENT[weather.condition]}
      />

      {/* Top-right soft glow that breathes — applies to every
         condition so the card never reads as static. */}
      <m.div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl"
        style={{ background: `${ACCENT[weather.condition]}40` }}
        animate={{
          opacity: [0.55, 0.95, 0.55],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <m.div
        layout
        style={{
          transitionProperty: "gap",
          transitionDuration: SMOOTH_CSS_DURATION,
          transitionTimingFunction: SMOOTH_CSS,
        }}
        className={`relative flex items-center ${
          expanded ? "gap-4" : "gap-3"
        }`}
      >
        {/* Emoji tile — silky size sweep on tap, heartbeat scale and
           clear-day side-sway layered on as continuous motion. Pulling
           the two animations apart (outer = size, inner = heartbeat)
           keeps motion from having to interpolate scale and width on
           the same element, which is what was making the tap-to-expand
           feel "elastic but rough". */}
        <m.span
          layout
          style={{
            transitionProperty: "width, height, font-size",
            transitionDuration: SMOOTH_CSS_DURATION,
            transitionTimingFunction: SMOOTH_CSS,
            willChange: "width, height, font-size",
          }}
          className={`grid shrink-0 place-items-center rounded-2xl bg-white/25 backdrop-blur ${
            expanded ? "h-14 w-14 text-3xl" : "h-9 w-9 text-lg"
          }`}
        >
          <m.span
            aria-hidden
            className="inline-flex"
            animate={{
              scale: [1, 1.05, 1],
              rotate:
                weather.condition === "clear"
                  ? [0, 8, 0, -8, 0]
                  : [0, 0],
            }}
            transition={{
              duration: weather.condition === "clear" ? 8 : 3.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {EMOJI[weather.condition]}
          </m.span>
        </m.span>

        <m.div layout className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              style={{
                transitionProperty: "font-size",
                transitionDuration: SMOOTH_CSS_DURATION,
                transitionTimingFunction: SMOOTH_CSS,
              }}
              className={`font-extrabold leading-none tracking-tight drop-shadow-sm ${
                expanded ? "text-3xl" : "text-lg"
              }`}
            >
              {weather.tempC}°
            </span>
            <span
              style={{
                transitionProperty: "font-size",
                transitionDuration: SMOOTH_CSS_DURATION,
                transitionTimingFunction: SMOOTH_CSS,
              }}
              className={`font-bold uppercase tracking-wider text-white/95 ${
                expanded ? "text-sm" : "text-[11px]"
              }`}
            >
              {weather.description}
            </span>
          </div>
        </m.div>

        {/* Chevron — rotates 180° when expanded. Lives inside the
           same flex row so the layout stays balanced regardless of
           the description's length. */}
        <m.span
          layout
          aria-hidden
          style={{
            transitionProperty: "width, height",
            transitionDuration: SMOOTH_CSS_DURATION,
            transitionTimingFunction: SMOOTH_CSS,
          }}
          className={`grid shrink-0 place-items-center rounded-full bg-white/20 text-white backdrop-blur ${
            expanded ? "h-9 w-9" : "h-7 w-7"
          }`}
        >
          <m.span
            className="inline-flex"
            animate={{ rotate: expanded ? 180 : 0 }}
          >
            <span
              style={{
                transitionProperty: "width, height",
                transitionDuration: SMOOTH_CSS_DURATION,
                transitionTimingFunction: SMOOTH_CSS,
              }}
              className={`inline-flex ${expanded ? "h-4 w-4" : "h-3.5 w-3.5"}`}
            >
              <Icon name="chevron-down" className="h-full w-full" />
            </span>
          </m.span>
        </m.span>
      </m.div>

      {/* Expanded panel — slides + fades the witty line in/out.
         `layout` on the parent button handles the height transition,
         AnimatePresence ensures the panel exits cleanly when the
         user collapses again. */}
      <AnimatePresence initial={false}>
        {expanded && (
          <m.div
            key="witty"
            layout
            className="relative mt-4 border-t border-white/15 pt-4"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            // Matched to the global SMOOTH curve so the witty line
            // fades in along the SAME timing rail the tile/font-size
            // sweep rides — no second-stage "stutter".
            transition={{ duration: SMOOTH_DURATION, ease: SMOOTH_EASE }}
          >
            <p className="text-sm leading-relaxed text-white/95">
              {weather.witty}
            </p>
            {weather.apparentC != null &&
              weather.apparentC !== weather.tempC && (
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-white/70">
                  Feels like {weather.apparentC}°
                </p>
              )}
          </m.div>
        )}
      </AnimatePresence>
    </m.button>
    </MotionConfig>
  );
}

/**
 * Per-condition motion layer behind the content. Cheap CSS-driven
 * animations so the card feels alive without burning CPU.
 */
function ConditionMotion({
  condition,
  accent,
}: {
  condition: Condition;
  accent: string;
}) {
  const particles = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: 5 + Math.random() * 90,
      top: 5 + Math.random() * 90,
      delay: Math.random() * 4,
      size: 8 + Math.random() * 20,
    }));
  }, []);

  if (condition === "rain" || condition === "thunderstorm") {
    return (
      <>
        {particles.map((p) => (
          <m.span
            key={p.id}
            aria-hidden
            className="pointer-events-none absolute h-6 w-0.5 rounded-full"
            style={{
              left: `${p.left}%`,
              background: accent,
              opacity: 0.4,
            }}
            initial={{ top: "-10%" }}
            animate={{ top: "110%" }}
            transition={{
              duration: 1.4 + Math.random() * 0.8,
              repeat: Infinity,
              delay: p.delay,
              ease: "linear",
            }}
          />
        ))}
        {condition === "thunderstorm" && (
          <m.span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0, 0.35, 0, 0, 0] }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "linear",
              times: [0, 0.4, 0.5, 0.51, 0.53, 0.7, 1],
            }}
          />
        )}
      </>
    );
  }

  if (condition === "snow") {
    return (
      <>
        {particles.map((p) => (
          <m.span
            key={p.id}
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              left: `${p.left}%`,
              width: p.size * 0.4,
              height: p.size * 0.4,
              background: accent,
              opacity: 0.7,
            }}
            initial={{ top: "-10%" }}
            animate={{ top: "110%", x: [0, 6, -6, 0] }}
            transition={{
              top: {
                duration: 5 + Math.random() * 2,
                repeat: Infinity,
                delay: p.delay,
                ease: "linear",
              },
              x: {
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
          />
        ))}
      </>
    );
  }

  const drift = condition === "clear" ? 14 : condition === "fog" ? 22 : 18;
  const opacity =
    condition === "clear" ? 0.35 : condition === "fog" ? 0.22 : 0.28;

  return (
    <>
      {particles.map((p) => (
        <m.span
          key={p.id}
          aria-hidden
          className="pointer-events-none absolute rounded-full blur-md"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            background: accent,
            opacity,
          }}
          animate={{
            x: [0, 25, -15, 0],
            y: [0, -10, 8, 0],
            opacity: [opacity, opacity * 1.4, opacity * 0.7, opacity],
          }}
          transition={{
            duration: drift,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </>
  );
}
