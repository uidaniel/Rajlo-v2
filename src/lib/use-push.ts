"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Browser-side web push lifecycle hook.
 *
 * Returns the current state + a small set of actions the settings page
 * (or any "enable notifications" CTA) can call:
 *
 *   - `support`         — true if this browser supports web push at all.
 *   - `permission`      — "default" | "granted" | "denied" (Notification API).
 *   - `subscribed`      — true if a PushSubscription exists in the SW.
 *   - `enable()`        — registers SW, requests permission, subscribes,
 *                         posts the subscription to /api/push/subscribe.
 *   - `disable()`       — unsubscribes from the SW + clears server side.
 *   - `sendTest()`      — POSTs /api/push/test for a self-buzz.
 *
 * Designed so the caller can render a single toggle: "Enable push" with
 * a "Send test" button that becomes active after subscribing. iOS Safari
 * requires the page to be installed as a PWA — `support` is false there
 * until that's done, which we surface in the UI.
 */

type Status = {
  support: boolean;
  permission: NotificationPermission | "default";
  subscribed: boolean;
  ready: boolean;
};

const SW_PATH = "/sw.js";

export function usePush() {
  const [status, setStatus] = useState<Status>({
    support: false,
    permission: "default",
    subscribed: false,
    ready: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // Initial detect — runs once on mount (and after a successful action
  // to keep the UI in sync with the SW state).
  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    const support =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!support) {
      setStatus({ support: false, permission: "default", subscribed: false, ready: true });
      return;
    }

    let subscribed = false;
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        subscribed = !!sub;
      }
    } catch {
      /* ignore — treat as not subscribed */
    }

    setStatus({
      support: true,
      permission: Notification.permission,
      subscribed,
      ready: true,
    });
  }, []);

  useEffect(() => {
    void refresh();
    // Also re-run on tab focus — if the user enables/disables system
    // notifications while we're in the background, this catches it.
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const enable = useCallback(async () => {
    setError(null);
    setWorking(true);
    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("This browser doesn't support push notifications.");
      }

      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) {
        throw new Error(
          "Push isn't configured on the server yet. Try again later.",
        );
      }

      // Register the worker. Browsers ignore re-registering an
      // identical worker so this is cheap on every call.
      const reg =
        (await navigator.serviceWorker.getRegistration(SW_PATH)) ??
        (await navigator.serviceWorker.register(SW_PATH));
      await navigator.serviceWorker.ready;

      // Ask permission. We bail early if the user denied — most browsers
      // won't re-prompt after a denial.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error(
          permission === "denied"
            ? "Notifications were blocked. Enable them in your browser's site settings."
            : "Notification permission wasn't granted.",
        );
      }

      // Subscribe. If a subscription already exists from a previous
      // session we re-use it instead of generating a new one — that
      // keeps the same row server-side rather than spawning duplicates.
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          // Cast through BufferSource — modern TS lib.dom narrowed the
          // accepted type to ArrayBuffer-only Uint8Array which our
          // helper can't always satisfy under strict settings.
          applicationServerKey: urlBase64ToUint8Array(
            vapid,
          ) as unknown as BufferSource,
        });
      }

      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      if (!res.ok) {
        throw new Error(`Server rejected subscription (${res.status}).`);
      }

      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't enable push.");
    } finally {
      setWorking(false);
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    setError(null);
    setWorking(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't disable push.");
    } finally {
      setWorking(false);
    }
  }, [refresh]);

  const sendTest = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as
        | { ok: boolean; sent?: number; reason?: string; error?: string }
        | Record<string, never>;
      if (!res.ok || !("ok" in data) || data.ok === false) {
        throw new Error(
          ("error" in data ? data.error : null) ??
            ("reason" in data ? data.reason : null) ??
            "Couldn't send test push.",
        );
      }
      if ("sent" in data && data.sent === 0) {
        setError(
          "No devices subscribed yet — enable push above first, then try again.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send test push.");
    }
  }, []);

  return {
    ...status,
    error,
    working,
    enable,
    disable,
    sendTest,
    /** Surfaced for the UI to render a "Configure server" hint when the
     *  VAPID public key isn't baked into the bundle. */
    configured: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  };
}

/** VAPID `applicationServerKey` must be a Uint8Array — convert from
 *  the URL-safe base64 string we serve via env. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}
