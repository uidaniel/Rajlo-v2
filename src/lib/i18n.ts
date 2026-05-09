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
  /* ─── Common UI words used across the app ─── */
  "common.loading": "A load up…",
  "common.save": "Save",
  "common.saving": "A save…",
  "common.saved": "Save",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.continue": "Continue",
  "common.back": "Back",
  "common.close": "Close",
  "common.signin": "Sign in",
  "common.signout": "Sign out",
  "common.signup": "Sign up",
  "common.tryAgain": "Try again",
  "common.search": "Search",
  "common.empty": "Notn here yet",
  "common.error": "Sup'n gwaan wrong",

  /* ─── Rider sidebar nav ─── */
  "nav.rider.dashboard": "Yaad",
  "nav.rider.request": "Hail a ride",
  "nav.rider.liveTrip": "Live trip",
  "nav.rider.fare": "Fare breakdown",
  "nav.rider.payments": "Payment dem",
  "nav.rider.history": "History",
  "nav.rider.spending": "Spending",
  "nav.rider.ratings": "Rating dem",
  "nav.rider.notifications": "Notification",
  "nav.rider.settings": "Setting dem",
  "nav.rider.support": "Help",
  "nav.rider.safety": "Safety",

  /* ─── Driver sidebar nav ─── */
  "nav.driver.dashboard": "Yaad",
  "nav.driver.documents": "Document dem",
  "nav.driver.verification": "TA verify",
  "nav.driver.requests": "Ride request dem",
  "nav.driver.activeTrip": "Active trip",
  "nav.driver.seats": "Seat dem",
  "nav.driver.earnings": "Money mek",
  "nav.driver.payouts": "Payout dem",
  "nav.driver.history": "History",
  "nav.driver.ratings": "Rating dem",
  "nav.driver.notifications": "Notification",
  "nav.driver.profile": "Profile",
  "nav.driver.support": "Help & safety",

  /* ─── Rider home / dashboard ─── */
  "rider.home.eyebrow": "Welkom back",
  "rider.home.title": "Weh yuh ago today?",
  "rider.home.subtitle":
    "Hail a verify red-plate driver. Fare set by parish.",
  "rider.home.cta.request": "Hail a ride",
  "rider.home.cta.live": "View active trip",
  "rider.home.recent": "Recent trip dem",
  "rider.home.viewAll": "See all",
  "rider.home.empty": "Yuh nuh tek a ride yet — book yuh first one.",

  /* ─── Rider notifications ─── */
  "notifications.eyebrow": "Inbox",
  "notifications.title": "Notification",
  "notifications.subtitle":
    "Trip update, promo, an safety tip — all inna one place.",
  "notifications.unread": "Unread",
  "notifications.markAllRead": "Mark all read",
  "notifications.tab.all": "All",
  "notifications.tab.trips": "Trip dem",
  "notifications.tab.promos": "Promo dem",
  "notifications.tab.system": "System",
  "notifications.empty.fresh": "Notn here yet",
  "notifications.empty.fresh.desc":
    "Once yuh book or tek ride, di update dem land here.",
  "notifications.empty.allRead": "Yuh all caught up",
  "notifications.empty.allRead.desc":
    "Notn fi dis filter. Switch tab dem above.",
  "notifications.prefs.title": "Notification preference",
  "notifications.prefs.desc":
    "Pick weh alert dem yuh want — push, email, or in-app.",

  /* ─── Rider history ─── */
  "history.eyebrow": "Trip history",
  "history.title": "Yuh past ride dem",
  "history.subtitle":
    "Receipt, rating, and re-book — everyting yuh do wid Rajlo.",
  "history.stat.completed": "Trip complete",
  "history.stat.spent": "Total spend",
  "history.stat.seeBreakdown": "See breakdown",
  "history.tab.all": "All",
  "history.tab.ongoing": "Goin on",
  "history.tab.cancelled": "Cancel",

  /* ─── Rider analytics / spending ─── */
  "analytics.eyebrow": "Spending",
  "analytics.thisMonth": "Dis month",
  "analytics.last7": "Last 7 day",
  "analytics.longestTrip": "Longest trip",
  "analytics.allTime": "All time",
  "analytics.last30": "Last 30 day",
  "analytics.trips30": "Trip · 30d",
  "analytics.avgFare": "Average fare",
  "analytics.saved": "Save",
  "analytics.monthly": "Monthly spend",
  "analytics.byParish": "Spend by parish",
  "analytics.topRoutes": "Top route dem",
  "analytics.cancelled": "Cancel trip",
  "analytics.carpool": "Carpool trip",
  "analytics.empty": "Nuh spending yet",
  "analytics.empty.desc":
    "Tek yuh first ride an di breakdown ago show up here.",
  "analytics.empty.cta": "Book a ride",

  /* ─── Rider safety ─── */
  "safety.eyebrow": "Safety toolkit",
  "safety.title": "Yuh in control",
  "safety.subtitle":
    "Trusted contact, share trip, an SOS — alla so it run.",

  /* ─── Rider support ─── */
  "support.eyebrow": "Help centre",
  "support.title": "How wi can help?",
  "support.subtitle":
    "Search di FAQ, or pick a quick action below fi go straight to di right place.",
  "support.searchPlaceholder": "Search help article…",
  "support.cat.trips": "Trip dem",
  "support.cat.payments": "Payment",
  "support.cat.safety": "Safety",
  "support.cat.account": "Account",
  "support.contact.title": "Talk to wi support team",
  "support.contact.subtitle":
    "Real people inna Kingston — answer wi within a few hour.",

  /* ─── Settings page chrome (existing) ─── */
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
