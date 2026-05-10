"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * `useLiveQuery` — fetch a JSON URL with automatic polling so the UI
 * stays current without the user reloading. Used across the admin
 * surface so every dashboard, queue, and detail page picks up DB
 * changes within one polling cycle.
 *
 * Behaviour:
 *   - Fetches once when `url` becomes truthy and on every change.
 *   - Re-fetches every `interval` ms thereafter.
 *   - Pauses when the browser tab is hidden (Page Visibility API),
 *     resumes — and immediately re-fetches — when it becomes visible.
 *     That keeps the dashboard snappy when the admin returns to the
 *     tab without burning a request every 10s on a backgrounded page.
 *   - `loading` is true only on the very first request; subsequent
 *     refreshes are signalled by `refreshing` so the page can leave
 *     the existing data on screen and avoid skeleton flashes.
 *   - Failed requests keep the last successful payload visible; the
 *     `error` field surfaces the most recent failure for badge UI.
 *
 * Pass `enabled: false` to skip the request entirely (e.g., until a
 * required prerequisite — auth user, route param — is known).
 */

type Options = {
  /** Polling interval in ms. Set to 0 to disable polling (one-shot). */
  interval?: number;
  /** Skip the request entirely while false. */
  enabled?: boolean;
  /** Pause polling when the tab is in the background. Default true. */
  pauseWhenHidden?: boolean;
};

export type LiveQueryResult<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
};

export function useLiveQuery<T>(
  url: string | null,
  options: Options = {},
): LiveQueryResult<T> {
  const {
    interval = 30_000,
    enabled = true,
    pauseWhenHidden = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Tracks the latest URL so an in-flight request that resolves AFTER
  // the URL changed (filter switch, navigation) doesn't clobber the
  // newer data. Without this guard, a slow earlier request could
  // overwrite a fast newer one on screen.
  const latestUrlRef = useRef<string | null>(null);

  const fetcher = useCallback(
    async (isRefresh: boolean) => {
      if (!url || !enabled) return;
      latestUrlRef.current = url;
      if (isRefresh) setRefreshing(true);
      try {
        // `cache: "no-store"` defends against browser HTTP caches
        // serving a stale response when the only thing that changed
        // is a query string filter (e.g., admin Transactions range
        // tab clicks). Polling endpoints should never be cached.
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as T;
        if (latestUrlRef.current !== url) return;
        setData(json);
        setError(null);
        setLastUpdated(new Date());
      } catch (e) {
        if (latestUrlRef.current !== url) return;
        setError(e instanceof Error ? e.message : "Fetch failed");
      } finally {
        if (latestUrlRef.current !== url) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [url, enabled],
  );

  // Initial + url/enabled change fetch — explicit "loading" reset so
  // the consumer can swap to a skeleton when the URL flips (e.g., the
  // admin switches between filter tabs).
  useEffect(() => {
    if (!url || !enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetcher(false);
  }, [url, enabled, fetcher]);

  // Polling + visibility integration.
  useEffect(() => {
    if (!enabled || interval <= 0 || !url) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (
          pauseWhenHidden &&
          typeof document !== "undefined" &&
          document.hidden
        ) {
          return;
        }
        fetcher(true);
      }, interval);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (!pauseWhenHidden) return;
      if (document.hidden) {
        stop();
      } else {
        // Returning to the tab — refetch once immediately so the
        // numbers reflect what changed while we were away, then
        // resume the interval cadence.
        fetcher(true);
        start();
      }
    };

    start();
    if (pauseWhenHidden && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      stop();
      if (pauseWhenHidden && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [enabled, interval, url, pauseWhenHidden, fetcher]);

  const refresh = useCallback(async () => {
    await fetcher(true);
  }, [fetcher]);

  return { data, loading, refreshing, error, lastUpdated, refresh };
}
