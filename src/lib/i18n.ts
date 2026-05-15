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
  "settings.connected.payments": "Wallet & top-ups",
  "settings.connected.payments.desc":
    "Balance, deposit history, an save card.",
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

  /* ─── Driver dashboard ─── */
  "driver.dashboard.eyebrow": "Driver dashboard",
  "driver.dashboard.greeting": "Yow {name}, yuh live.",
  "driver.dashboard.greetingOff": "Yow {name}, yuh offline.",
  "driver.dashboard.subtitle":
    "Incoming ride request dem ago show below.",
  "driver.dashboard.subtitleOff":
    "Flip di toggle pon di right side fi start tek ride.",
  "driver.dashboard.onlineSince": "Online since {time}",
  "driver.dashboard.online": "Online",
  "driver.dashboard.offline": "Offline",
  "driver.dashboard.thisWeek": "Dis week",
  "driver.dashboard.today": "Today",
  "driver.dashboard.rating": "Rating",
  "driver.dashboard.noRatings": "Nuh rating yet",
  "driver.dashboard.trips": "{n} trip dem",
  "driver.dashboard.liveRequests": "Live ride request",
  "driver.dashboard.waiting": "{n} waiting",
  "driver.dashboard.noRequests": "Nuh request right now",
  "driver.dashboard.noRequestsDesc":
    "Stay online — di nex one ago come in.",
  "driver.dashboard.acceptRide": "Accept ride",
  "driver.dashboard.justNow": "Jus now",
  "driver.dashboard.minAgo": "{n}m ago",
  "driver.dashboard.thisMonth": "Dis month",
  "driver.dashboard.acceptance": "Acceptance · 30d",
  "driver.dashboard.driverRating": "Driver rating",
  "driver.dashboard.driverSince": "Drivin wid Rajlo since {date}",
  "driver.dashboard.dailyBreakdown": "Daily breakdown",
  "driver.dashboard.bestDay": "Best day",
  "driver.dashboard.compliance": "Compliance health",
  "driver.dashboard.compliance.allClear": "Everyting up to date",
  "driver.dashboard.compliance.expired":
    "{n} document expire — fix it now",
  "driver.dashboard.compliance.urgent":
    "{n} document ago expire pon yuh",
  "driver.dashboard.compliance.upcoming":
    "{n} document fi renew soon",
  "driver.dashboard.compliance.view": "View compliance",
  "driver.dashboard.activeTrip.banner": "Yuh have an active trip",
  "driver.dashboard.activeTrip.bannerDesc":
    "Tap fi go back to di trip console.",
  "driver.dashboard.activeTrip.cta": "Open trip",
  "driver.dashboard.locationOff": "Location sharing off",
  "driver.dashboard.statsError": "Cyaan load yuh stats right now.",
  "driver.dashboard.tryAgain": "Try again",
  "driver.dashboard.quickActions": "Quick action dem",
  "driver.dashboard.qa.verification": "TA verification",
  "driver.dashboard.qa.history": "Trip history",
  "driver.dashboard.qa.earnings": "Earnings",
  "driver.dashboard.qa.profile": "Profile",

  /* ─── Driver active trip ─── */
  "driver.activeTrip.title": "Active trip",
  "driver.activeTrip.noTrip": "Nuh active trip",
  "driver.activeTrip.noTripDesc":
    "Go back to di dashboard an wait fi di nex request.",
  "driver.activeTrip.backToDashboard": "Back to dashboard",
  "driver.activeTrip.stage.accepted.eyebrow": "Headin to pickup",
  "driver.activeTrip.stage.accepted.headline":
    "Drive to di pickup location",
  "driver.activeTrip.stage.accepted.description":
    "Tap when yuh reach so di rider know yuh outside.",
  "driver.activeTrip.stage.accepted.action": "Mi reach pickup",
  "driver.activeTrip.stage.arrived.eyebrow": "At pickup",
  "driver.activeTrip.stage.arrived.headline": "Pick up yuh rider",
  "driver.activeTrip.stage.arrived.description":
    "Confirm di rider inna di car, den start di trip fi begin di meter.",
  "driver.activeTrip.stage.arrived.action": "Start trip",
  "driver.activeTrip.stage.inProgress.eyebrow": "Pon di way",
  "driver.activeTrip.stage.inProgress.headline": "Trip in progress",
  "driver.activeTrip.stage.inProgress.description":
    "Drive safe. Tap complete when yuh drop di rider off.",
  "driver.activeTrip.stage.inProgress.action": "Complete trip",
  "driver.activeTrip.openMapsPickup": "Open Google Maps · drive to pickup",
  "driver.activeTrip.openMapsDropoff": "Open Google Maps · drive to dropoff",
  "driver.activeTrip.working": "A work…",
  "driver.activeTrip.cancelTrip": "Cancel di trip",
  "driver.activeTrip.estFare": "Estimated fare",
  "driver.activeTrip.tripDetails": "Trip details",
  "driver.activeTrip.from": "From",
  "driver.activeTrip.to": "To",
  "driver.activeTrip.seats": "{n} seat",
  "driver.activeTrip.notes": "Note from rider",
  "driver.activeTrip.kmAway": "{km} km away",
  "driver.activeTrip.minAway": "~{min} min",

  /* ─── Driver earnings ─── */
  "driver.earnings.eyebrow": "Earnings · {range}",
  "driver.earnings.range.today": "Today",
  "driver.earnings.range.week": "Dis week",
  "driver.earnings.range.month": "Dis month",
  "driver.earnings.completedTrips": "{n} complete trip",
  "driver.earnings.delta.up": "+{pct}%",
  "driver.earnings.delta.down": "−{pct}%",
  "driver.earnings.avgPerTrip": "Avg / trip",
  "driver.earnings.trips": "Trip dem",
  "driver.earnings.bestDay": "Best day",
  "driver.earnings.dailyBreakdown": "Daily breakdown",
  "driver.earnings.dailyHint": "Tap a bar fi see dat day trip dem",
  "driver.earnings.nextPayout": "Next payout",
  "driver.earnings.payoutHint":
    "Paid out every Monday by 17:00 to yuh link account.",
  "driver.earnings.payoutSetup": "Payout setup",
  "driver.earnings.recent": "Recent complete trip",
  "driver.earnings.noTrips": "Nuh trip yet inna dis range",
  "driver.earnings.noTripsDesc":
    "Once yuh complete a trip it ago show up here.",
  "driver.earnings.failedToLoad": "Cyaan load yuh earnings",

  /* ─── Driver history ─── */
  "driver.history.eyebrow": "Driver history",
  "driver.history.title": "Yuh past trip dem",
  "driver.history.subtitle":
    "Rider name, fare, an feedback — everyting yuh did pon Rajlo.",
  "driver.history.pageEarnings": "Pon dis page",
  "driver.history.completed": "Complete",
  "driver.history.cancelled": "Cancel",
  "driver.history.loadMore": "Load more",
  "driver.history.loadingMore": "A load…",
  "driver.history.empty": "Yuh nuh have past trip yet",
  "driver.history.emptyDesc":
    "Once yuh complete a trip, it ago show up here.",
  "driver.history.failedToLoad": "Cyaan load yuh history",
  "driver.history.rateRider": "Rate di rider",
  "driver.history.youRated": "Yuh rate dem {stars} star",
  "driver.history.riderRated": "Rider rate yuh {stars} star",
  "driver.history.noRating": "Nuh rating yet",
  "driver.history.carpool": "Carpool",
  "driver.history.cancelledByYou": "Yuh cancel",
  "driver.history.cancelledByRider": "Di rider cancel",

  /* ─── Driver profile ─── */
  "driver.profile.eyebrow": "Yuh profile",
  "driver.profile.subtitle":
    "Yuh details show to yuh rider. Vehicle colour, plate, an name appear pon every match.",
  "driver.profile.banner.title": "Dese show to yuh rider",
  "driver.profile.banner.desc":
    "Vehicle colour, plate, an name show pon di rider live-trip view, share link, an history. Keep dem accurate.",
  "driver.profile.section.picture": "Profile picture",
  "driver.profile.section.personal": "Personal",
  "driver.profile.section.vehicle": "Vehicle",
  "driver.profile.section.compliance": "Compliance",
  "driver.profile.section.push": "Push notification",
  "driver.profile.personal.hint":
    "Dese details tie to yuh TA verification. To change dem, contact support.",
  "driver.profile.field.firstName": "First name",
  "driver.profile.field.lastName": "Last name",
  "driver.profile.field.phone": "Phone",
  "driver.profile.field.email": "Email",
  "driver.profile.field.phoneHelp":
    "Rider call dis number through Rajlo masked-call system.",
  "driver.profile.field.emailHelp":
    "Email change need re-verification — contact support.",
  "driver.profile.vehicle.type": "Type",
  "driver.profile.vehicle.brand": "Brand",
  "driver.profile.vehicle.model": "Model",
  "driver.profile.vehicle.year": "Year",
  "driver.profile.vehicle.colour": "Colour",
  "driver.profile.vehicle.plate": "Plate",
  "driver.profile.vehicle.preview": "Rider preview",
  "driver.profile.vehicle.notRegistered": "Vehicle nuh register yet",
  "driver.profile.vehicle.change.title": "Got a different car?",
  "driver.profile.vehicle.change.desc":
    "Vehicle change need fresh registration, COF, an insurance document dem. Submit a request an wi team ago review within 1–2 business day.",
  "driver.profile.vehicle.change.cta": "Request change",
  "driver.profile.compliance.hint":
    "Dese TA-tied identifier cyaan self-edit — change need re-verification. Contact support fi update.",
  "driver.profile.compliance.plate": "Plate number",
  "driver.profile.compliance.licence": "Licence number",
  "driver.profile.compliance.badge": "TA badge number",
  "driver.profile.compliance.franchise": "Franchise number",
  "driver.profile.compliance.viewDash": "View compliance dashboard",
  "driver.profile.delete.title": "Delete yuh driver account",
  "driver.profile.delete.desc":
    "Dis permanently remove yuh profile, ride history, rating dem, wallet, an verification record. Yuh cyaan get it back.",
  "driver.profile.delete.cta": "Delete account",

  /* ─── Driver notifications ─── */
  "driver.notifications.eyebrow": "Inbox",
  "driver.notifications.title": "Notification",
  "driver.notifications.subtitle":
    "Trip update, renewal reminder, an safety alert dem.",
  "driver.notifications.unread": "Unread",
  "driver.notifications.markAllRead": "Mark all read",
  "driver.notifications.tab.all": "All",
  "driver.notifications.tab.trips": "Trip dem",
  "driver.notifications.tab.renewals": "Renewal dem",
  "driver.notifications.tab.system": "System",
  "driver.notifications.empty.fresh": "Notn here yet",
  "driver.notifications.empty.fresh.desc":
    "Trip update, document reminder, an payout note land here.",
  "driver.notifications.empty.allRead": "Yuh all caught up",
  "driver.notifications.renewals": "Renewal reminder",
  "driver.notifications.renewals.empty":
    "All yuh document dem up to date — nice work.",

  /* ─── Driver settings (extend existing rider keys for driver context) ─── */
  "driver.settings.eyebrow": "Driver",
  "driver.settings.title": "Setting dem",
  "driver.settings.subtitle":
    "Appearance, language, an notification preference dem.",
  "driver.settings.account": "Account",
  "driver.settings.account.name": "Name",
  "driver.settings.account.email": "Email",
  "driver.settings.account.manage": "Manage profile",
  "driver.settings.appearance": "Appearance",
  "driver.settings.appearance.theme": "Theme",
  "driver.settings.appearance.themeDesc":
    "Match yuh system, or pin to light or dark.",
  "driver.settings.language": "Language",
  "driver.settings.language.label": "Display language",
  "driver.settings.language.desc":
    "Switch in-app copy. Patwa cover di main driver flow.",
  "driver.settings.notifications.title": "Notification",
  "driver.settings.notifications.blocked":
    "Notification block at di OS level. Open yuh phone Setting → App → Rajlo Driver → Notification an turn it on.",
  "driver.settings.notifications.master": "Allow push notification",
  "driver.settings.notifications.master.on":
    "On fi dis device. Other device stay separate.",
  "driver.settings.notifications.master.off":
    "Master switch — turn off fi mute everyting below.",
  "driver.settings.notifications.tripUpdates": "Ride update",
  "driver.settings.notifications.tripUpdates.desc":
    "Ping fi new ride request, rider chat, an trip status change.",
  "driver.settings.notifications.safety": "Safety alert",
  "driver.settings.notifications.safety.desc":
    "SOS, location-off, an other safety system message.",
  "driver.settings.notifications.promos": "Promo & announcement",
  "driver.settings.notifications.promos.desc":
    "Bonus programme, new feature, occasional news. Rare.",
  "driver.settings.quickLinks": "Quick link dem",
  "driver.settings.quickLinks.help": "Help & safety",
  "driver.settings.quickLinks.help.desc":
    "SOS, support contact, safety tip dem.",
  "driver.settings.quickLinks.verification": "Verification status",
  "driver.settings.quickLinks.verification.desc":
    "TA document pon file + renewal date dem.",
  "driver.settings.quickLinks.wallet": "Wallet",
  "driver.settings.quickLinks.wallet.desc":
    "Balance, transaction, payout setup.",
  "driver.settings.danger.title": "Delete yuh driver account",
  "driver.settings.danger.desc":
    "Permanently remove yuh profile, ride history, rating, wallet, an verification record. Yuh cyaan recover it.",
  "driver.settings.danger.cta": "Delete account",
  "driver.settings.saved": "Save",

  /* ─── Common driver actions used across pages ─── */
  "driver.common.acceptRide": "Accept ride",
  "driver.common.openTrip": "Open trip",
  "driver.common.cancelTrip": "Cancel di trip",
  "driver.common.failedToLoad": "Cyaan load",
  "driver.common.loadAgain": "Try again",
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
