"use client";

import { useEffect, useMemo, useState } from "react";
import { m } from "motion/react";
import { Icon, type IconName } from "./icons";

/**
 * Weather hero strip for the rider booking page.
 *
 * Asks the browser for the rider's coarse location (cached 30 min so
 * we're not hammering the GPS), fetches /api/weather for that point,
 * and renders a friendly current-conditions card with a witty quip
 * tuned to the condition ("Rainy day — grab your umbrella").
 *
 * Gradients are deliberately DEEP so the white headline + body copy
 * stay readable on every condition — the previous pastel-fog and
 * pastel-clear treatments washed out the text. Each card also gets
 * its own condition-specific motion: drifting orbs, falling rain
 * lines, lightning flashes, etc. — keeps the strip from reading as
 * a static banner.
 *
 * Silently renders nothing when:
 *   - The browser has no geolocation support
 *   - The rider denies the permission prompt
 *   - The weather upstream fails
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

const ICON: Record<Condition, IconName> = {
  clear: "star",
  cloudy: "map",
  rain: "navigation",
  thunderstorm: "alert-triangle",
  fog: "search",
  snow: "shield",
};

// Darker, saturated gradients so the white text always reads cleanly.
// Each one keeps a hint of the condition's identity (warm gold for
// clear, deep cyan for rain, midnight purple for storms, etc.) without
// going so light at the start that the foreground copy disappears.
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

// Hue used for the floating-orb particles + icon halo so each
// condition's motion layer reads as a tint of that condition.
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
    <div
      className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg"
      style={{ background: GRADIENT[weather.condition] }}
    >
      {/* Condition-specific motion layer. Lives behind the content
         at low opacity so it never competes for legibility with the
         headline + witty line. */}
      <ConditionMotion
        condition={weather.condition}
        accent={ACCENT[weather.condition]}
      />

      {/* Top-right soft glow that gently breathes — applies to every
         condition so even fog + cloudy don't look static. */}
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

      <div className="relative flex items-center gap-4">
        <m.span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/25 backdrop-blur"
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
          <Icon name={ICON[weather.condition]} className="h-7 w-7" />
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
          <p className="mt-1 text-sm leading-snug text-white/95">
            {weather.witty}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Per-condition motion layer. Each branch renders something tuned to
 * the weather so the card feels alive without being noisy:
 *   - clear        → slow drifting golden orbs (sun "particles")
 *   - cloudy       → slow horizontal drift of soft white blobs (clouds)
 *   - rain         → vertical falling streaks (drops)
 *   - thunderstorm → occasional flash + falling streaks
 *   - fog          → very slow horizontal drift of low-opacity blobs
 *   - snow         → falling soft white dots
 */
function ConditionMotion({
  condition,
  accent,
}: {
  condition: Condition;
  accent: string;
}) {
  // Memoise the random positions so particles stay in place between
  // re-renders — re-rolling them every commit would jerk the
  // animation and ruin the calm-drift effect.
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
            animate={{
              top: "110%",
              x: [0, 6, -6, 0],
            }}
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

  // clear / cloudy / fog → slow drifting orbs. Same primitive, just
  // different counts/speeds/opacities.
  const drift =
    condition === "clear" ? 14 : condition === "fog" ? 22 : 18;
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
