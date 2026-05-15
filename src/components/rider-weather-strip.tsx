"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig, m } from "motion/react";
import { Icon } from "./icons";

// Shared expand/collapse spring. Critically damped (no overshoot), unit
// mass so the motion feels physical, stiffness tuned so the whole thing
// settles in ~600ms. Spring beats a duration curve here because every
// animated property (padding, gap, tile size, font size, chevron) rides
// the SAME physics solver, so they finish on the same frame instead of
// drifting apart the way parallel CSS transitions do. That frame-level
// synchronization is what reads as one liquid motion instead of several
// near-misses fighting each other.
const SMOOTH = {
  type: "spring" as const,
  stiffness: 170,
  damping: 26,
  mass: 1,
};

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
  // Measured pixel height of the witty-panel content. We animate this
  // number → 0 instead of `height: "auto"` → 0, because motion has a
  // separate value resolver for "auto" that doesn't always honour the
  // MotionConfig spring — that mismatch was making the bottom edge
  // snap on collapse while expand felt smooth. With a concrete pixel
  // height, the spring drives both directions on the same timeline.
  const panelContentRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(0);

  // Keep `panelHeight` synced with the real measured height of the
  // witty paragraph (which can wrap differently as the weather copy
  // or viewport changes). ResizeObserver covers re-flows from font
  // load, copy swap, or window resize.
  useEffect(() => {
    const el = panelContentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setPanelHeight(el.scrollHeight);
    });
    ro.observe(el);
    setPanelHeight(el.scrollHeight);
    return () => ro.disconnect();
  }, [weather]);

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
    // Single source of timing truth. Every nested `m.*` that doesn't
    // override its own `transition` inherits this spring — so padding,
    // gap, tile size, font size, chevron tile size and the witty panel
    // all settle on the same frame as one liquid motion.
    <MotionConfig transition={SMOOTH}>
    <m.button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      // No `layout` here — the witty panel below animates its own
      // height explicitly, so the button's height shrinks via natural
      // flow (which IS smooth). Adding `layout` on top of that ran two
      // motion systems on the same box, which is what made the bottom
      // edge appear to snap at collapse-end.
      initial={{ padding: 12 }}
      animate={{ padding: expanded ? 20 : 12 }}
      style={{ background: GRADIENT[weather.condition] }}
      className="relative block w-full cursor-pointer overflow-hidden rounded-2xl text-left text-white shadow-lg"
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
        initial={{ gap: 12 }}
        animate={{ gap: expanded ? 16 : 12 }}
        className="relative flex items-center"
      >
        {/* Emoji tile — silky size sweep on tap, heartbeat scale and
           clear-day side-sway layered on as continuous motion. The
           outer span owns size; the inner span owns heartbeat. Splitting
           them means motion doesn't have to interpolate scale and width
           on the same element, which is what made the earlier version
           feel "elastic but rough". */}
        <m.span
          initial={{ width: 36, height: 36, fontSize: 18 }}
          animate={{
            width: expanded ? 56 : 36,
            height: expanded ? 56 : 36,
            fontSize: expanded ? 30 : 18,
          }}
          className="grid shrink-0 place-items-center rounded-2xl bg-white/25 backdrop-blur"
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

        <m.div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <m.span
              initial={{ fontSize: 18 }}
              animate={{ fontSize: expanded ? 30 : 18 }}
              className="font-extrabold leading-none tracking-tight drop-shadow-sm"
            >
              {weather.tempC}°
            </m.span>
            <m.span
              initial={{ fontSize: 11 }}
              animate={{ fontSize: expanded ? 14 : 11 }}
              className="font-bold uppercase tracking-wider text-white/95"
            >
              {weather.description}
            </m.span>
          </div>
        </m.div>

        {/* Chevron — rotates 180° when expanded. Lives inside the
           same flex row so the layout stays balanced regardless of
           the description's length. */}
        <m.span
          aria-hidden
          initial={{ width: 28, height: 28 }}
          animate={{ width: expanded ? 36 : 28, height: expanded ? 36 : 28 }}
          className="grid shrink-0 place-items-center rounded-full bg-white/20 text-white backdrop-blur"
        >
          <m.span
            className="inline-flex"
            animate={{ rotate: expanded ? 180 : 0 }}
          >
            <Icon name="chevron-down" className="h-4 w-4" />
          </m.span>
        </m.span>
      </m.div>

      {/* Witty panel — kept mounted at all times and collapsed via a
         pixel-height tween (NOT `height: "auto"` — that channel uses
         motion's own value resolver and silently ignored our spring,
         which is why expand felt smooth but collapse snapped at the
         end). `panelHeight` is the live measured scrollHeight of the
         inner content; on expand we spring 0 → panelHeight, on
         collapse panelHeight → 0, both on the same spring as the
         rest of the strip — so every edge of the card moves on the
         same frame in both directions. */}
      <m.div
        aria-hidden={!expanded}
        initial={false}
        animate={{
          height: expanded ? panelHeight : 0,
          opacity: expanded ? 1 : 0,
          marginTop: expanded ? 16 : 0,
          paddingTop: expanded ? 16 : 0,
          borderTopWidth: expanded ? 1 : 0,
        }}
        transition={SMOOTH}
        style={{
          overflow: "hidden",
          borderTopStyle: "solid",
          borderTopColor: "rgba(255,255,255,0.15)",
        }}
        className="relative"
      >
        <div ref={panelContentRef}>
          <p className="text-sm leading-relaxed text-white/95">
            {weather.witty}
          </p>
          {weather.apparentC != null &&
            weather.apparentC !== weather.tempC && (
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-white/70">
                Feels like {weather.apparentC}°
              </p>
            )}
        </div>
      </m.div>
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
