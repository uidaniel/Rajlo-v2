"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Wake Lock + Visibility helper for the driver dashboard.
 *
 * Honest scope:
 *   Browsers can't run JavaScript timers when a tab is fully
 *   backgrounded or the screen is locked. There is no web API that
 *   gives us "background GPS like a native app". The closest we can
 *   get is the **Screen Wake Lock API** (`navigator.wakeLock`) which
 *   stops the OS from dimming/locking the screen while the page is
 *   visible. That keeps the heartbeat alive AS LONG AS the page
 *   stays foreground.
 *
 *   This hook does three things:
 *     1. Acquires a screen wake lock when `active` is true.
 *     2. Re-acquires the lock automatically if the OS releases it
 *        (e.g. the user briefly switched apps and came back — the
 *        spec releases the lock on visibility-hidden).
 *     3. Returns a `backgrounded` flag the UI can render as a clear
 *        warning ("App is in the background — riders' hails will not
 *        reach you until you bring Rajlo back to the front").
 *
 *   The driver dashboard should call this whenever the driver is
 *   online + not on an active trip (the trip page does its own wake
 *   lock for the duration of the trip).
 *
 * Browser support (as of 2026):
 *   - Chrome / Edge / Brave (Android + desktop) — full
 *   - Safari iOS 16.4+ — works only in installed PWAs
 *   - Firefox Android — not yet
 *   The hook degrades gracefully: if WakeLock isn't available it
 *   silently no-ops and `supported` returns false so the UI can warn
 *   the driver "your browser can't keep the screen awake".
 */

type Status = {
  /** Whether the browser supports the Wake Lock API at all. */
  supported: boolean;
  /** Whether the lock is currently held. */
  held: boolean;
  /** Whether the document is currently hidden (backgrounded). */
  backgrounded: boolean;
  /** Last error message from the WakeLock API, if any. */
  error: string | null;
};

// Type the API surface — TS lib.dom has WakeLock but not always with
// the cross-cut we want, depending on which version is installed.
type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
  removeEventListener: (type: "release", listener: () => void) => void;
};
type WakeLockApi = {
  request: (type: "screen") => Promise<WakeLockSentinel>;
};

function getWakeLock(): WakeLockApi | null {
  if (typeof navigator === "undefined") return null;
  const w = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
  return w ?? null;
}

export function useWakeLock(active: boolean): Status {
  const [held, setHeld] = useState(false);
  const [backgrounded, setBackgrounded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const supported = !!getWakeLock();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => setBackgrounded(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function acquire() {
      const api = getWakeLock();
      if (!api) return;
      try {
        const sentinel = await api.request("screen");
        if (cancelled) {
          await sentinel.release().catch(() => null);
          return;
        }
        sentinelRef.current = sentinel;
        setHeld(true);
        setError(null);
        sentinel.addEventListener("release", () => {
          if (!cancelled) setHeld(false);
        });
      } catch (e) {
        // Common cause: page not visible yet, or user denied. We
        // retry on visibility return; surface the message regardless
        // so the UI can hint at recovery steps.
        setHeld(false);
        setError(
          e instanceof Error ? e.message : "Couldn't keep the screen awake.",
        );
      }
    }

    async function release() {
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (s && !s.released) {
        await s.release().catch(() => null);
      }
      setHeld(false);
    }

    if (active && !backgrounded) {
      void acquire();
    } else if (!active) {
      void release();
    }

    return () => {
      cancelled = true;
      void release();
    };
    // Re-run on visibility change so the lock re-acquires when the
    // tab returns to the foreground (the spec releases it on hide).
  }, [active, backgrounded]);

  return { supported, held, backgrounded, error };
}
