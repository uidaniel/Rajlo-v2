import type { MetadataRoute } from "next";
import {
  PARISH_SLUGS,
  PUBLIC_MARKETING_ROUTES,
  SITE_URL,
} from "@/lib/site-config";

/**
 * Dynamic sitemap.xml.
 *
 * Three families of URLs:
 *   1. **Core marketing pages** — `/`, `/how-it-works`, `/fare-estimator`,
 *      `/driver-join`, `/drive-with-rajlo`, `/help`, `/contact`,
 *      `/download`, and the legal pages. Driven by
 *      `PUBLIC_MARKETING_ROUTES` in site-config so adding a new
 *      marketing page is a one-line change.
 *
 *   2. **Per-parish rideshare landing pages** — `/rideshare-in-[parish]`
 *      for each of the 14 Jamaican parishes. These target geo-specific
 *      long-tail queries ("rideshare in Kingston", "taxi in Montego
 *      Bay") that the homepage alone can't rank for.
 *
 *   3. **Per-parish driver acquisition pages** — `/driver-jobs-in-[parish]`
 *      for each parish, targeting "driver jobs in Jamaica" intent.
 *
 * Every URL is absolute (built from `SITE_URL`) so Google never
 * second-guesses the canonical host. `lastModified` is the build time
 * because the marketing copy is static — when content actually
 * changes we redeploy and Google picks up a fresh stamp.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const coreRoutes: MetadataRoute.Sitemap = PUBLIC_MARKETING_ROUTES.map(
    (route) => ({
      url: `${SITE_URL}${route.path}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }),
  );

  const parishRideshareRoutes: MetadataRoute.Sitemap = PARISH_SLUGS.map(
    (slug) => ({
      url: `${SITE_URL}/rideshare-in-${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }),
  );

  const parishDriverRoutes: MetadataRoute.Sitemap = PARISH_SLUGS.map(
    (slug) => ({
      url: `${SITE_URL}/driver-jobs-in-${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }),
  );

  return [...coreRoutes, ...parishRideshareRoutes, ...parishDriverRoutes];
}
