"use client";

import { useEffect, useRef } from "react";

/**
 * Silent safety-net poller.
 *
 * Calls `callback` every `intervalMs` while the tab is visible. When
 * the tab is hidden, the timer pauses; when it comes back into focus
 * the callback fires once immediately and the interval resumes.
 *
 * Designed as a belt-and-braces layer on top of Supabase Realtime:
 * the websocket can drop silently (network blip, backgrounded tab
 * for long enough that the browser kills the connection, mobile-OS
 * radio sleep), and when it does the page would otherwise stay
 * stuck on whatever state was true at the time of disconnect. With
 * this hook in the loop, the next visibility-change OR the next
 * interval tick re-pulls the canonical state from the server.
 *
 * Realtime stays the fast path — it's what gives sub-second updates
 * when it's working. This hook is the resilience layer.
 *
 * Implementation notes:
 *   - The latest `callback` is held in a ref so consumers can pass
 *     a fresh closure on every render (e.g. an arrow function
 *     defined inside the component) without re-installing the
 *     interval / visibility listeners.
 *   - We deliberately don't expose a "refreshing" flag — this is
 *     meant to be silent. If you need a visible "live · X seconds
 *     ago" indicator, use `useLiveQuery` instead.
 */
export function useBackgroundRefresh(
  callback: () => void | Promise<void>,
  intervalMs: number,
  options: { enabled?: boolean } = {},
): void {
  const { enabled = true } = options;
  const callbackRef = useRef(callback);

  // Keep the ref pointing at the freshest closure on every render.
  // We can't read `callback` directly inside the timer's effect
  // because that would re-run the effect on every render — defeating
  // the purpose of holding a stable interval.
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void callbackRef.current();
    };

    const start = () => {
      if (timer) return;
      timer = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        stop();
      } else {
        // Tab just came back into focus — refresh immediately so the
        // user sees fresh state right away, then resume the cadence.
        void callbackRef.current();
        start();
      }
    };

    start();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      stop();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [enabled, intervalMs]);
}
