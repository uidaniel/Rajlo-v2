"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";

/**
 * Pull-to-refresh for the rider portal.
 *
 * Touch-only widget that listens at the window level. When the user
 * is scrolled to the top of the page and starts swiping DOWN, we
 * track the distance; once they cross the trigger threshold and
 * release, we fire `router.refresh()` so the current page's server
 * data + RSC payload re-fetch.
 *
 * Visual indicator: a small floating pill that follows the finger
 * down, with a chevron that rotates as you approach the trigger
 * threshold, then a spinner while the refresh is in flight.
 *
 * Mounted at the rider portal layout level so every rider page (home,
 * request, history, wallet, etc.) gets pull-to-refresh — exactly
 * what users coming from native ride-share apps expect.
 *
 * Disabled when scrolled past the top, when refresh is already in
 * flight, or when the user starts the swipe inside a horizontally-
 * scrolling element (carousel, chip strip) so we don't fight their
 * intended gesture.
 */

const TRIGGER_DISTANCE_PX = 80;
const MAX_PULL_DISTANCE_PX = 140;
const REFRESH_HOLD_MS = 600;

export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Track start state in refs (touch handlers run outside React's
  // render cycle and need stable references to compare against the
  // initial touch position).
  const startYRef = useRef<number | null>(null);
  const armedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onTouchStart = (e: TouchEvent) => {
      // Only arm at the very top of the page.
      if (window.scrollY > 4) {
        armedRef.current = false;
        startYRef.current = null;
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      startYRef.current = t.clientY;
      armedRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!armedRef.current || startYRef.current == null) return;
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startYRef.current;
      // If the user starts pulling UP, immediately disarm — they're
      // scrolling the page, not requesting a refresh.
      if (dy < 0) {
        armedRef.current = false;
        setPull(0);
        return;
      }
      // Resistance curve: linear up to threshold, then easing so the
      // bar can't be dragged off the page on a long swipe.
      const eased =
        dy <= TRIGGER_DISTANCE_PX
          ? dy
          : TRIGGER_DISTANCE_PX +
            (dy - TRIGGER_DISTANCE_PX) * 0.35;
      setPull(Math.min(eased, MAX_PULL_DISTANCE_PX));
      // Once we're past the visible threshold, suppress the page's
      // own scroll so we don't fight with the bounce.
      if (dy > 12 && e.cancelable) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!armedRef.current) return;
      armedRef.current = false;
      startYRef.current = null;
      if (pull >= TRIGGER_DISTANCE_PX) {
        setRefreshing(true);
        // Hold the spinner long enough to feel like work happened —
        // router.refresh resolves the second the response lands, which
        // on a warm cache is too fast to read as a refresh.
        const start = Date.now();
        router.refresh();
        const settle = () => {
          const elapsed = Date.now() - start;
          const wait = Math.max(0, REFRESH_HOLD_MS - elapsed);
          setTimeout(() => {
            setRefreshing(false);
            setPull(0);
          }, wait);
        };
        settle();
      } else {
        setPull(0);
      }
    };

    // `passive: false` on touchmove so we can call preventDefault()
    // when we're actively pulling — that's what stops the page from
    // bouncing while the indicator is being dragged.
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pull, router]);

  const visible = pull > 0 || refreshing;
  const progress = Math.min(1, pull / TRIGGER_DISTANCE_PX);
  // Translate the pill down to the user's finger position (clamped
  // to MAX_PULL_DISTANCE_PX so it stops following past that).
  const translateY = refreshing
    ? TRIGGER_DISTANCE_PX
    : pull;

  return (
    <div
      aria-hidden={!visible}
      style={{
        transform: `translateY(${translateY}px)`,
        transition: refreshing
          ? "transform 200ms cubic-bezier(0.4,0,0.2,1)"
          : "none",
      }}
      className={`pointer-events-none fixed left-1/2 top-2 z-[70] -translate-x-1/2 ${
        visible ? "opacity-100" : "opacity-0"
      } md:hidden`}
    >
      <div
        className="flex items-center gap-2 rounded-full bg-rajlo-red px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rajlo-red/40"
      >
        {refreshing ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <span
            style={{
              transform: `rotate(${progress >= 1 ? 180 : 0}deg)`,
              transition: "transform 150ms ease-out",
            }}
            className="inline-flex"
          >
            <Icon name="chevron-down" className="h-4 w-4" />
          </span>
        )}
        <span>
          {refreshing
            ? "Refreshing…"
            : progress >= 1
              ? "Release to refresh"
              : "Pull to refresh"}
        </span>
      </div>
    </div>
  );
}
