/**
 * Client-side cache + helpers for the rider's app preferences (theme +
 * language). The canonical store is `rider_preferences` on the server
 * — we mirror to localStorage so every page load can apply the right
 * theme + lang BEFORE React hydrates (avoiding a flash of the wrong
 * theme), then re-sync from the server once the page is up.
 *
 * Three exported pieces:
 *   1. `applyTheme(theme)` — writes `data-theme` on <html> + flips
 *      the `lang` attribute.
 *   2. `readLocalPrefs()` — synchronous read for the no-FOUC bootstrap.
 *   3. `writeLocalPrefs(p)` — write-through after the user toggles.
 */

export type Theme = "system" | "light" | "dark";
export type Locale = "en" | "patois";

export type LocalPrefs = {
  theme: Theme;
  locale: Locale;
};

const KEY = "rajlo:prefs";
// Light is the platform default. Riders who want dark or follow-system
// flip it from /rider/settings; the choice persists to both
// localStorage (so the no-FOUC bootstrap on the next load picks it up
// before React hydrates) and rider_preferences (so it follows them
// across devices). Picking light by default — instead of "system" —
// keeps the very first paint on a brand-new install consistent with
// the brand palette and the marketing surfaces.
const DEFAULTS: LocalPrefs = { theme: "light", locale: "en" };

export function readLocalPrefs(): LocalPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<LocalPrefs>;
    return {
      theme:
        parsed.theme === "light" ||
        parsed.theme === "dark" ||
        parsed.theme === "system"
          ? parsed.theme
          : DEFAULTS.theme,
      locale:
        parsed.locale === "en" || parsed.locale === "patois"
          ? parsed.locale
          : DEFAULTS.locale,
    };
  } catch {
    return DEFAULTS;
  }
}

export function writeLocalPrefs(prefs: Partial<LocalPrefs>): void {
  if (typeof window === "undefined") return;
  try {
    const current = readLocalPrefs();
    const next = { ...current, ...prefs };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — silently ignore */
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (theme === "system") {
    // Leave it as "system" so the @media query in globals.css can
    // resolve to the OS preference. We DON'T strip the attribute
    // because some legacy CSS may already reference data-theme.
    html.setAttribute("data-theme", "system");
  } else {
    html.setAttribute("data-theme", theme);
  }
}

export function applyLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  // BCP-47 locale tag — `jam` is ISO 639-2 for Jamaican Creole;
  // some screen readers honour it for pronunciation hints.
  document.documentElement.setAttribute(
    "lang",
    locale === "patois" ? "jam" : "en",
  );
}

/**
 * Inline JS string — embedded into <head> via dangerouslySetInnerHTML
 * so it runs before any CSS or React hydration. Reads localStorage and
 * applies the data-theme attribute to <html> immediately, preventing
 * the dark-themed user from flashing white on every navigation.
 */
export const NO_FOUC_SCRIPT = `
(function(){
  try {
    var raw = window.localStorage.getItem('${KEY}');
    if (!raw) {
      document.documentElement.setAttribute('data-theme', 'light');
      return;
    }
    var p = JSON.parse(raw);
    var theme = (p && (p.theme === 'light' || p.theme === 'dark' || p.theme === 'system')) ? p.theme : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    if (p && p.locale === 'patois') document.documentElement.setAttribute('lang', 'jam');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`.trim();
