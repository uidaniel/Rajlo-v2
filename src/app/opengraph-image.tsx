import { ImageResponse } from "next/og";

/**
 * Dynamic Open Graph image for the marketing site.
 *
 * Next.js's file-based metadata API auto-detects this file and:
 *   - Renders it at `/opengraph-image` (with a content hash for
 *     cache busting)
 *   - Injects the matching `<meta property="og:image">` tag on every
 *     page that inherits the root metadata
 *
 * Rendered server-side via the Edge-compatible `ImageResponse` so
 * social-share previews on Twitter/X, Facebook, WhatsApp, LinkedIn,
 * iMessage, and Slack all show the same branded card.
 *
 * Design follows the Rajlo brand book:
 *   - Background: brand black `#111906`
 *   - Wordmark: white "Rajl" + red "o" (the brand's signature
 *     punctuation of the trademark)
 *   - Accent line in brand red on the left edge
 *   - Tagline + value-prop in the lower half so the wordmark sits
 *     in the optical centre
 *
 * Edit anything below and a fresh image deploys with the next build —
 * no PNG asset to maintain, no Figma round-trip.
 */

export const runtime = "edge";
export const alt = "Rajlo — Jamaica's rideshare platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#111906",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 100px",
          fontFamily: "Inter, system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Brand-red accent bar down the left edge — same vertical
            mark the print brand book uses on hero pages. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 90,
            bottom: 90,
            width: 12,
            background: "#f10100",
            borderRadius: 6,
          }}
        />

        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: "#f10100",
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          Jamaica's rideshare platform
        </div>

        {/* Wordmark — "Rajl" white + "o" red, mirrors the print
            wordmark exactly so the OG card reads as the same brand
            mark across every share surface. */}
        <div
          style={{
            display: "flex",
            fontSize: 220,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          <span style={{ color: "#ffffff" }}>Rajl</span>
          <span style={{ color: "#f10100" }}>o</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            color: "#ffffff",
            marginTop: 28,
            letterSpacing: "-0.02em",
          }}
        >
          Let&apos;s go!
        </div>

        {/* Value props row */}
        <div
          style={{
            display: "flex",
            gap: 36,
            marginTop: 36,
            fontSize: 24,
            fontWeight: 600,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <span>Verified drivers</span>
          <span style={{ color: "#f10100" }}>·</span>
          <span>Transparent fares</span>
          <span style={{ color: "#f10100" }}>·</span>
          <span>All 14 parishes</span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
