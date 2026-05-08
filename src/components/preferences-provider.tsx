"use client";

import { useEffect } from "react";
import {
  applyLocale,
  applyTheme,
  readLocalPrefs,
  writeLocalPrefs,
  type Locale,
  type Theme,
} from "@/lib/preferences-client";

/**
 * Background sync between the server's `rider_preferences` row and the
 * client's localStorage cache. Mounts once inside the rider portal
 * layout. Renders nothing — pure side-effect.
 *
 * What it does:
 *   1. On mount, fetch /api/rider/preferences → write to localStorage
 *      → apply theme + locale to <html> (catches users who change
 *      preferences on another device)
 *   2. Listen for `prefers-color-scheme` changes → re-apply when in
 *      "system" theme so dark mode follows the OS in real time.
 *
 * The no-FOUC inline script in the root layout already applied a
 * theme from localStorage before paint, so this component's apply is
 * effectively a no-op the first time around. It only matters when the
 * server pref differs from cache (cross-device sync).
 */
export function PreferencesProvider() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/rider/preferences");
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          preferences: { theme: Theme; language: "en" | "patois" };
        };
        const { theme, language } = json.preferences;
        const locale: Locale = language;
        // Persist + apply if different from cache.
        const cached = readLocalPrefs();
        if (cached.theme !== theme || cached.locale !== locale) {
          writeLocalPrefs({ theme, locale });
          applyTheme(theme);
          applyLocale(locale);
          window.dispatchEvent(new Event("rajlo:prefs-changed"));
        }
      } catch {
        /* offline or 401 — local cache stays in charge */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-apply when the OS dark/light preference changes — but only
  // while the user is in "system" mode, otherwise their explicit
  // choice should win.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const cached = readLocalPrefs();
      if (cached.theme === "system") applyTheme("system");
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return null;
}
