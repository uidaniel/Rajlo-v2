import type { Metadata } from "next";
import {
  buildStaticMapImageUrl,
  getTripShareData,
} from "@/lib/trip-share-data";

/**
 * Server-side layout that generates Open Graph + Twitter card meta
 * for the public trip-share page. WhatsApp / iMessage / Slack
 * / Twitter all read these tags and unfurl the link into a rich
 * preview card with title, description, and a map image of the route.
 *
 * The page itself is a "use client" component so `generateMetadata`
 * has to live here (layouts are server components by default).
 *
 * If the token is invalid/expired we still return safe defaults
 * rather than 404-ing the meta — the page itself handles the error
 * UI, and we don't want a misconfigured share to leak that fact via
 * 404 noise on Twitter Card validators.
 */

const STATUS_DESCRIPTIONS: Record<string, string> = {
  requested: "Looking for a driver",
  accepted: "Driver heading to pickup",
  arrived: "Driver at pickup",
  in_progress: "On the way",
  completed: "Trip complete",
  cancelled: "Trip cancelled",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const trip = await getTripShareData(token);

  if (!trip) {
    return {
      title: "Trip share · Rajlo",
      description:
        "Watch a Rajlo ride live. Verified red-plate drivers across Jamaica.",
      // Generic OG card for invalid links.
      openGraph: {
        title: "Trip share · Rajlo",
        description: "Live trip tracking from Jamaica's red-plate ride network.",
        siteName: "Rajlo",
        type: "website",
      },
      twitter: { card: "summary" },
    };
  }

  const riderName = trip.riderFirstName
    ? `${trip.riderFirstName}'s ride`
    : trip.recipientLabel
      ? `${trip.recipientLabel}'s ride`
      : "a Rajlo ride";

  const title = `Track ${riderName} · Rajlo`;
  const subline = STATUS_DESCRIPTIONS[trip.status] ?? "Live trip share";

  // Description packs the route into the line that shows under the
  // title in WhatsApp/Slack/iMessage previews.
  const description = `${subline} · ${trip.pickup.name} → ${trip.dropoff.name}${
    trip.estimatedEtaMinutes !== null
      ? ` · ETA ~${trip.estimatedEtaMinutes} min`
      : ""
  }`;

  const mapImage = buildStaticMapImageUrl(
    { lat: trip.pickup.lat, lng: trip.pickup.lng },
    { lat: trip.dropoff.lat, lng: trip.dropoff.lng },
    trip.stops.map((s) => ({ lat: s.lat, lng: s.lng })),
  );

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Rajlo",
      // og:image ranks first; if Google Static Maps is configured we
      // serve that, otherwise platforms render the default site card
      // (Rajlo logo etc. — handled by the root layout).
      images: mapImage
        ? [
            {
              url: mapImage,
              width: 1200,
              height: 630,
              alt: `${trip.pickup.name} to ${trip.dropoff.name}`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: mapImage ? "summary_large_image" : "summary",
      title,
      description,
      images: mapImage ? [mapImage] : undefined,
    },
    // Search engines don't need to index ephemeral share links.
    robots: { index: false, follow: false },
  };
}

export default function TripShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
