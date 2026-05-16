/**
 * Shared SEO + brand identity for the marketing surface.
 *
 * All public-facing URLs, structured-data fields, and the canonical
 * domain live here so adding a new SEO page (parish landing, driver
 * jobs, blog post) is one import, not 15 hardcoded values that drift
 * out of sync the moment the domain or tagline changes.
 *
 * The site URL is env-driven so the same code serves:
 *   - dev:          http://localhost:3000
 *   - Vercel preview: rajlo-v2.vercel.app (blocked from indexing — see robots.ts)
 *   - production:   https://rajlo.com (the moment DNS is pointed)
 *
 * The DEFAULT is the eventual production URL on purpose: every absolute
 * URL we emit (canonical tags, sitemap, OG image, JSON-LD) points at
 * rajlo.com from day one, so launch-day flips DNS + env var and SEO is
 * live without rewriting any code.
 */

import { PARISHES, type Parish } from "@/lib/jamaica";

/** Canonical production URL for the marketing site. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://rajlo.com"
).replace(/\/$/, "");

/** Brand display name. */
export const SITE_NAME = "Rajlo";

/** One-liner tagline — used in OG title fallback + the brand schema. */
export const SITE_TAGLINE = "Let's go!";

/** Full marketing description — used in default meta description, OG, JSON-LD. */
export const SITE_DESCRIPTION =
  "Rajlo is Jamaica's trusted rideshare platform. Verified red-plate drivers, transparent parish-based pricing, multi-seat bookings, and real-time tracking — across all 14 parishes.";

/** Public-facing contact email surfaced in Organization schema. */
export const SITE_EMAIL = "hello@rajlo.com";

// OG / Twitter share images are not configured here — they're served
// from the file-based `src/app/opengraph-image.tsx` (and the matching
// `twitter-image.tsx` re-export) which Next.js auto-detects and
// injects on every page inheriting the root metadata. Edit those
// files to redesign the share card.

/** Approximate central coordinates of Jamaica — used in LocalBusiness
 *  geo schema and area-served polygon centre. */
export const JAMAICA_GEO = { lat: 18.1096, lng: -77.2975 };

/** Slugify a parish name for a URL path.
 *
 *  "Kingston"       → "kingston"
 *  "St. Andrew"     → "st-andrew"
 *  "St. Catherine"  → "st-catherine"
 *
 *  This is the canonical mapping — both the parish dynamic routes and
 *  the sitemap use this so URLs and links never drift apart.
 */
export function parishToSlug(parish: Parish): string {
  return parish
    .toLowerCase()
    .replace(/\./g, "") // "St." -> "St"
    .replace(/\s+/g, "-"); // spaces -> dashes
}

/** Inverse of parishToSlug — used by the dynamic route to recover the
 *  display name from a URL segment. Returns null for unknown slugs so
 *  the page can 404 cleanly instead of rendering garbage. */
export function slugToParish(slug: string | undefined | null): Parish | null {
  // Guard against an undefined/empty segment — a caller getting a bad
  // route param should cleanly 404 (via the page's notFound()), not
  // crash on `.toLowerCase()`.
  if (!slug) return null;
  const normalized = slug.toLowerCase();
  for (const parish of PARISHES) {
    if (parishToSlug(parish) === normalized) return parish;
  }
  return null;
}

/** All parish slugs — used by sitemap + generateStaticParams. */
export const PARISH_SLUGS = PARISHES.map(parishToSlug);

/**
 * Per-parish editorial metadata used to give each `/rideshare-in/[parish]`
 * and `/driver-jobs-in/[parish]` page genuinely unique content. Google
 * penalises thin geo-modified duplicate pages ("rideshare in X" templates
 * that just swap one word), so each entry contributes:
 *   - `capital`: parish capital town, surfaced in the hero copy.
 *   - `popularDestinations`: 3 known places — used in the "popular
 *     routes" section so each page has unique route examples.
 *   - `vibe`: one-sentence flavour line for the page intro.
 *
 * These are editor-authored facts a templater can't auto-generate,
 * which is exactly what makes them SEO-defensible. Raj can refine the
 * copy here without touching any page code.
 */
export const PARISH_INFO: Record<
  Parish,
  { capital: string; popularDestinations: string[]; vibe: string }
> = {
  Kingston: {
    capital: "Kingston",
    popularDestinations: ["Downtown Kingston", "New Kingston", "Half Way Tree"],
    vibe:
      "Jamaica's capital and the busiest rideshare market on the island — from late-night runs in New Kingston to early-morning office commutes.",
  },
  "St. Andrew": {
    capital: "Half Way Tree",
    popularDestinations: ["Constant Spring", "Liguanea", "Stony Hill"],
    vibe:
      "The corporate belt that wraps around Kingston — schools, malls, and the bulk of the morning commuter traffic.",
  },
  "St. Catherine": {
    capital: "Spanish Town",
    popularDestinations: ["Portmore", "Spanish Town", "Old Harbour"],
    vibe:
      "Home to Portmore — Jamaica's largest bedroom community — plus Spanish Town and the route to Kingston that thousands take every workday.",
  },
  Clarendon: {
    capital: "May Pen",
    popularDestinations: ["May Pen", "Chapelton", "Frankfield"],
    vibe:
      "Central Jamaica's farming heart — May Pen markets, bauxite plants, and the south-coast corridor.",
  },
  Manchester: {
    capital: "Mandeville",
    popularDestinations: ["Mandeville", "Christiana", "Porus"],
    vibe:
      "Cool hills, university campuses, and a steady stream of trips between Mandeville and the south-coast highway.",
  },
  "St. Elizabeth": {
    capital: "Black River",
    popularDestinations: ["Black River", "Santa Cruz", "Junction"],
    vibe:
      "Wide farmlands, the Black River safari, and the south coast's quieter beach towns.",
  },
  Westmoreland: {
    capital: "Savanna-la-Mar",
    popularDestinations: ["Negril", "Savanna-la-Mar", "Little London"],
    vibe:
      "Negril's seven-mile beach, late-night Sav runs, and the airport corridor from Sangster to the west coast.",
  },
  Hanover: {
    capital: "Lucea",
    popularDestinations: ["Lucea", "Hopewell", "Sandy Bay"],
    vibe:
      "The quiet stretch between Negril and Mobay — beach resorts, fishing villages, and the coast road that connects them.",
  },
  "St. James": {
    capital: "Montego Bay",
    popularDestinations: ["Montego Bay", "Sangster Airport", "Rose Hall"],
    vibe:
      "Montego Bay — Jamaica's tourism capital — plus the airport runs and resort corridor that never sleeps.",
  },
  Trelawny: {
    capital: "Falmouth",
    popularDestinations: ["Falmouth", "Duncans", "Clark's Town"],
    vibe:
      "The Falmouth cruise port and the coast road that links Montego Bay to Ocho Rios.",
  },
  "St. Ann": {
    capital: "St. Ann's Bay",
    popularDestinations: ["Ocho Rios", "Runaway Bay", "Brown's Town"],
    vibe:
      "Ocho Rios cruise ships, all-inclusive resorts, and the north-coast highway that connects them.",
  },
  "St. Mary": {
    capital: "Port Maria",
    popularDestinations: ["Port Maria", "Annotto Bay", "Oracabessa"],
    vibe:
      "The quiet north-east coast — banana country, Goldeneye, and the bridge from Ocho Rios to Portland.",
  },
  Portland: {
    capital: "Port Antonio",
    popularDestinations: ["Port Antonio", "Boston Bay", "Long Bay"],
    vibe:
      "The hidden Jamaica — Blue Mountains, jerk's birthplace at Boston Bay, and the wild north-east coast.",
  },
  "St. Thomas": {
    capital: "Morant Bay",
    popularDestinations: ["Morant Bay", "Yallahs", "Bath"],
    vibe:
      "The south-east — Morant Bay's historic courthouse and the mineral springs at Bath.",
  },
};

/** Public marketing routes that get indexed + listed in the sitemap.
 *  Auth-gated routes (/rider, /driver, /admin, /auth/*) are kept out
 *  intentionally — Googlebot can't sign in, so indexing them creates
 *  dead-end results.
 */
export const PUBLIC_MARKETING_ROUTES: Array<{
  path: string;
  /** Search engine priority hint, 0..1. Higher = more important. */
  priority: number;
  /** Update cadence hint for Googlebot's recrawl scheduler. */
  changeFrequency:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
}> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/how-it-works", priority: 0.8, changeFrequency: "monthly" },
  { path: "/fare-estimator", priority: 0.9, changeFrequency: "monthly" },
  { path: "/driver-join", priority: 0.9, changeFrequency: "monthly" },
  { path: "/help", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
  { path: "/download", priority: 0.7, changeFrequency: "monthly" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
];
