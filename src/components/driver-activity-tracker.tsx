"use client";

import { useEffect, useRef } from "react";

/**
 * Renders nothing — just runs a hook that pings `/api/driver/heartbeat`
 * while the driver portal is mounted, and detects local idle so the
 * driver flips offline after an hour of no interaction even if their
 * tab stays open.
 *
 * Two clocks running side by side:
 *
 *   1. **Heartbeat ping**: every `HEARTBEAT_MS` we POST a heartbeat.
 *      The endpoint updates `last_active_at` AND sweeps any stale
 *      online drivers offline as a side effect. So even drivers who
 *      closed their browser entirely get cleaned up by the next
 *      online driver's heartbeat.
 *
 *   2. **Local idle detection**: we listen for `pointerdown`,
 *      `keydown`, `touchstart`, and `scroll` and reset a "last
 *      interaction" timestamp on each. When a heartbeat fires and
 *      that timestamp is older than `IDLE_THRESHOLD_MS`, we send
 *      `setOffline: true` so the driver is flipped immediately
 *      (instead of waiting up to another hour for the server-side
 *      sweep to catch them).
 *
 * The component mounts inside the driver portal layout, so the
 * tracker runs everywhere — dashboard, active trip, requests page,
 * settings — wherever a driver is.
 */

// One heartbeat every 5 minutes is enough to keep the row warm
// without being chatty. With 100 online drivers that's ~20 writes
// per minute platform-wide, well inside Supabase's free tier.
const HEARTBEAT_MS = 5 * 60 * 1000;

// Mirrors the server-side STALE_THRESHOLD_MS in the heartbeat route.
// If you change one, change the other — keeping both 1 hour means
// the local idle detection and the server sweep cut off at the same
// time, so there's no window where a tab is "still open but idle"
// staying online.
const IDLE_THRESHOLD_MS = 60 * 60 * 1000;

export function DriverActivityTracker() {
  // Last user interaction. Initialised to 0 here (calling Date.now()
  // in the useRef initializer would violate the react-hooks/purity
  // rule) and set to "now" inside the effect so a fresh tab starts
  // counted as fully active.
  const lastInteractionRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    lastInteractionRef.current = Date.now();

    const onInteraction = () => {
      lastInteractionRef.current = Date.now();
    };

    // `passive: true` on touch + scroll so we never block scrolling.
    // We only listen on `window` (event delegation), not every
    // child — one set of listeners covers the whole portal.
    window.addEventListener("pointerdown", onInteraction);
    window.addEventListener("keydown", onInteraction);
    window.addEventListener("touchstart", onInteraction, { passive: true });
    window.addEventListener("scroll", onInteraction, { passive: true });

    const sendHeartbeat = async () => {
      const idleFor = Date.now() - lastInteractionRef.current;
      const setOffline = idleFor >= IDLE_THRESHOLD_MS;
      try {
        await fetch("/api/driver/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(setOffline ? { setOffline: true } : {}),
          keepalive: true,
        });
      } catch {
        // Best-effort — a missed heartbeat just means the next one
        // (or the server-side sweep) will handle it. Never surface.
      }
    };

    // Fire one immediately so a freshly-opened tab gets a current
    // last_active_at right away.
    void sendHeartbeat();
    const interval = setInterval(sendHeartbeat, HEARTBEAT_MS);

    return () => {
      clearInterval(interval);
      window.removeEventListener("pointerdown", onInteraction);
      window.removeEventListener("keydown", onInteraction);
      window.removeEventListener("touchstart", onInteraction);
      window.removeEventListener("scroll", onInteraction);
    };
  }, []);

  return null;
}
