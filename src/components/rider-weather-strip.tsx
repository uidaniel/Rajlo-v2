"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";

/**
 * Weather hero strip for the rider booking page.
 *
 * Asks the browser for the rider's coarse location (cached 30 min so
 * we're not hammering the GPS), fetches /api/weather for that point,
 * and renders a friendly current-conditions card with a witty quip
 * tuned to the condition ("Rainy day — grab your umbrella").
 *
 * Silently renders nothing when:
 *   - The browser has no geolocation support
 *   - The rider denies the permission prompt
 *   - The weather upstream fails
 *
 * Failing soft is intentional: the rider booking screen shouldn't
 * error out because the weather widget can't reach Open-Meteo.
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
  clear: "star", // sun proxy — closest in our existing icon set
  cloudy: "map",
  rain: "navigation",
  thunderstorm: "alert-triangle",
  fog: "search",
  snow: "shield",
};

const GRADIENT: Record<Condition, string> = {
  clear:
    "linear-gradient(135deg, #fef3c7 0%, #fcd34d 60%, #f59e0b 100%)",
  cloudy:
    "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 60%, #818cf8 100%)",
  rain:
    "linear-gradient(135deg, #cffafe 0%, #67e8f9 60%, #0891b2 100%)",
  thunderstorm:
    "linear-gradient(135deg, #fef3c7 0%, #fbbf24 40%, #4c1d95 100%)",
  fog:
    "linear-gradient(135deg, #f3f4f6 0%, #d1d5db 60%, #6b7280 100%)",
  snow:
    "linear-gradient(135deg, #f0f9ff 0%, #bae6fd 60%, #0284c7 100%)",
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
      // Coarse position is fine — we round to 0.1° on the server anyway.
      // Wide maxAge so we don't re-prompt for GPS every page load.
      { enableHighAccuracy: false, maximumAge: 30 * 60_000, timeout: 6_000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Render nothing while we're still waiting OR if the user denied —
  // a "weather denied" placeholder would be noisier than the absence
  // of the strip.
  if (!weather || denied) return null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg"
      style={{ background: GRADIENT[weather.condition] }}
    >
      {/* Subtle texture overlay so the gradient doesn't read flat */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/15 blur-3xl"
      />
      <div className="relative flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/25 backdrop-blur">
          <Icon name={ICON[weather.condition]} className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold leading-none tracking-tight">
              {weather.tempC}°
            </span>
            <span className="text-sm font-bold uppercase tracking-wider text-white/85">
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
