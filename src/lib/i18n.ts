"use client";

import { useEffect, useState } from "react";
import {
  applyLocale,
  readLocalPrefs,
  type Locale,
} from "./preferences-client";

/**
 * Tiny in-process i18n.
 *
 * Why no react-intl / next-intl: those frameworks add ~50KB and a
 * heavier mental model than this app needs while we're translating a
 * handful of Jamaican-Patois strings. A flat `t(key)` lookup with
 * English fallback is enough — every key starts in English, and the
 * patois map fills in coverage incrementally.
 *
 * `useT()` returns the `t` function pre-bound to the current locale,
 * resolved from the localStorage mirror written by the preferences
 * provider. It re-reads on every mount, and the components that drive
 * the toggle pass the new locale through directly so UI flips
 * immediately without waiting for a re-render of the provider tree.
 */

type Dict = Record<string, string>;

/* ──────────────────────────────────────────────────────────────────────
   Patois dictionary
   Approximate Jamaican Patois renderings — written in informal
   spelling that's friendly to read for a Patois speaker but still
   parseable by a standard-English reader. Not academic. We can refine
   with native input over time.
   ────────────────────────────────────────────────────────────────────── */

const PATOIS: Dict = {
  // Settings page chrome
  "settings.eyebrow": "Account",
  "settings.title": "Setting dem",
  "settings.subtitle":
    "Yuh profile, push pings, app dem preference, an account safety.",
  "settings.saved": "Save",

  // Section titles
  "settings.section.profile": "Yuh profile",
  "settings.section.push": "Push notification",
  "settings.section.app": "App preference",
  "settings.section.connected": "Connected",
  "settings.section.signout": "Sign out",

  // Profile copy
  "settings.profile.verified": "Email verify",
  "settings.profile.edit": "Change",

  // Push toggles
  "settings.push.master": "Allow push notification",
  "settings.push.master.on":
    "On for dis device. Other device dem stay separate.",
  "settings.push.master.off":
    "Master switch — turn it off fi mute everyting below.",
  "settings.push.test": "Send test",
  "settings.push.test.hint": "Verify yuh setup wid a sample push.",
  "settings.push.trip": "Trip update",
  "settings.push.trip.desc":
    "Driver accept, reach, start, an done.",
  "settings.push.arrival": "Driver reach",
  "settings.push.arrival.desc": "Loud ping when yuh driver pull up.",
  "settings.push.promo": "Promo & discount",
  "settings.push.promo.desc":
    "Carpool deal, free-trip reward, an seasonal promo dem.",
  "settings.push.safety": "Safety tip",
  "settings.push.safety.desc":
    "Reminder bout di safety toolkit feature dem.",

  // App preferences
  "settings.app.language": "Language",
  "settings.app.language.desc": "Used cross di app an email receipt dem.",
  "settings.app.language.en": "English",
  "settings.app.language.patois": "Patwa",
  "settings.app.theme": "Theme",
  "settings.app.theme.desc": "Match yuh device or pin to one mode.",
  "settings.app.theme.system": "System",
  "settings.app.theme.light": "Light",
  "settings.app.theme.dark": "Dark",

  // Connected section
  "settings.connected.payments": "Payment method",
  "settings.connected.payments.desc":
    "Card, mobile money, an cash setting.",
  "settings.connected.safety": "Safety toolkit",
  "settings.connected.safety.desc":
    "Trusted contact, SOS, share-trip default.",
  "settings.connected.support": "Help & support",
  "settings.connected.support.desc": "FAQ, contact wi, an report a problem.",

  // Sign out
  "settings.signout.label": "Sign out",
  "settings.signout.desc":
    "Yuh ago haffi sign in again pon dis device.",
  "settings.signout.button": "Sign out",
  "settings.signout.confirm": "Sign out a Rajlo?",
  "settings.signout.signingOut": "Signin out…",

  // Footer line
  "settings.footer": "Rajlo · Jamaica red-plate ride network",
};

const DICTS: Record<Locale, Dict> = {
  en: {}, // empty: keys resolve to their fallback string
  patois: PATOIS,
};

export type TranslationFn = (key: string, fallback: string) => string;

export function translate(locale: Locale): TranslationFn {
  const dict = DICTS[locale] ?? {};
  return (key, fallback) => dict[key] ?? fallback;
}

/**
 * Hook that returns the live `t` function. Re-binds when the locale
 * preference changes via `localStorage` (cross-tab) or via a custom
 * `rajlo:prefs-changed` event we dispatch from the settings page so
 * toggling locale updates the visible UI without a hard refresh.
 */
export function useT(): {
  t: TranslationFn;
  locale: Locale;
  setLocale: (l: Locale) => void;
} {
  const [locale, setLocaleState] = useState<Locale>(() => readLocalPrefs().locale);

  useEffect(() => {
    const onChange = () => setLocaleState(readLocalPrefs().locale);
    window.addEventListener("storage", onChange);
    window.addEventListener("rajlo:prefs-changed", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("rajlo:prefs-changed", onChange);
    };
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    applyLocale(l);
    // Notify other useT()s in the same tab (storage event only fires
    // across tabs).
    window.dispatchEvent(new Event("rajlo:prefs-changed"));
  };

  return {
    t: translate(locale),
    locale,
    setLocale,
  };
}
