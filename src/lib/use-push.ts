"use client";

import { useCallback, useEffect, useState } from "react";
import { iosNeedsPwaInstall, isIOS } from "./platform-detect";

/**
 * Browser-side web push lifecycle hook.
 *
 * Returns the current state + a small set of actions the settings page
 * (or any "enable notifications" CTA) can call:
 *
 *   - `support`            — true if this browser CAN support web push
 *                             right now (not just "the API exists").
 *   - `iosNeedsInstall`    — true on iOS Safari running in a regular
 *                             tab. iOS only allows web push from a
 *                             home-screen-installed PWA — the user
 *                             must Share → Add to Home Screen, then
 *                             open from the icon, before push works.
 *                             We surface this distinct from `support`
 *                             so the UI can show the right hint.
 *   - `permission`         — "default" | "granted" | "denied".
 *   - `subscribed`         — true if a PushSubscription exists in SW.
 *   - `enable()`           — registers SW, requests permission, subscribes,
 *                             posts the subscription to /api/push/subscribe.
 *   - `disable()`          — unsubscribes from the SW + clears server side.
 *   - `sendTest()`         — POSTs /api/push/test for a self-buzz.
 */

type Status = {
  support: boolean;
  iosNeedsInstall: boolean;
  permission: NotificationPermission | "default";
  subscribed: boolean;
  ready: boolean;
};

const SW_PATH = "/sw.js";

export function usePush() {
  const [status, setStatus] = useState<Status>({
    support: false,
    iosNeedsInstall: false,
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
    const apiPresent =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    // iOS Safari ships the Notification + PushManager APIs in any
    // mode, but actually subscribing only works when the page is
    // running as an installed PWA (Add to Home Screen). Treat that
    // case as "not yet supported" so the UI tells the user what to
    // do instead of letting them tap Enable and hit a cryptic error.
    const iosNeedsInstall = iosNeedsPwaInstall();
    const support = apiPresent && !iosNeedsInstall;

    if (!support) {
      setStatus({
        support: false,
        iosNeedsInstall,
        permission: "default",
        subscribed: false,
        ready: true,
      });
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
      iosNeedsInstall: false,
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

      // iOS Safari guard — even if the API surface exists, push only
      // works after the user installs the PWA. Surface the path
      // instead of letting Notification.requestPermission silently
      // resolve "denied".
      if (iosNeedsPwaInstall()) {
        throw new Error(
          "On iPhone you have to install Rajlo first. Tap the Share button (square with up arrow), then Add to Home Screen, then open Rajlo from the new icon and try again.",
        );
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
    /** True when the device is iOS and the page is in a regular tab.
     *  Lets the UI surface a "Add to Home Screen first" guide. */
    iosHint: isIOS(),
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
