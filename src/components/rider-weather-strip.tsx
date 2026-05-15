"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Icon } from "./icons";

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
    <m.button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      // `layout` makes motion animate the height change automatically
      // when the witty-line panel slides in or out — no manual
      // measuring of the expanded height required.
      layout
      className="relative block w-full cursor-pointer overflow-hidden rounded-2xl p-5 text-left text-white shadow-lg"
      style={{ background: GRADIENT[weather.condition] }}
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

      <m.div layout className="relative flex items-center gap-4">
        {/* Emoji tile — heartbeat scale always on, an extra side-sway
           for the sunny variant so a clear day visibly "shines". */}
        <m.span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/25 text-3xl backdrop-blur"
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
          <span aria-hidden>{EMOJI[weather.condition]}</span>
        </m.span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold leading-none tracking-tight drop-shadow-sm">
              {weather.tempC}°
            </span>
            <span className="text-sm font-bold uppercase tracking-wider text-white/95">
              {weather.description}
            </span>
          </div>
        </div>

        {/* Chevron — rotates 180° when expanded. Lives inside the
           same flex row so the layout stays balanced regardless of
           the description's length. */}
        <m.span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 text-white backdrop-blur"
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
          <Icon name="chevron-down" className="h-4 w-4" />
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
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
