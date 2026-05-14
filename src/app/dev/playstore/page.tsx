import type { Metadata } from "next";
import Image from "next/image";
import { LogoIcon } from "@/components/logo";

/**
 * Play Store screenshot composer (internal — not linked from anywhere
 * in the app, intentionally undiscoverable).
 *
 * Renders six 1080×1920 dark-themed driver-app slides plus a
 * 1024×500 feature graphic, each one designed to be screenshotted
 * with Chrome DevTools → right-click the slide → "Capture node
 * screenshot". The exports come out at the exact pixel sizes Play
 * Store wants, no extra cropping needed.
 *
 * The driver brand uses Rajlo dark (#111906) rather than the brand
 * red — that's the rider-app accent. Driver-side stays muted so the
 * launcher tile, splash, and dashboard hero all read as one surface.
 */

export const metadata: Metadata = {
  title: "Rajlo Driver — Play Store screenshots",
  robots: { index: false, follow: false },
};

type Slide = {
  /** File under public/playstore/screenshots/ */
  file: string;
  /** Small pill above the headline */
  eyebrow: string;
  /** Big white headline */
  headline: string;
  /** Supporting line below */
  subtitle: string;
};

const SLIDES: Slide[] = [
  {
    file: "1000536544.jpg",
    eyebrow: "Real-time dispatch",
    headline: "Go live, take rides.",
    subtitle:
      "Sign on and start earning instantly. Ride requests pop up the moment a rider hails near you.",
  },
  {
    file: "1000536545.jpg",
    eyebrow: "Built for the road",
    headline: "Drive with confidence.",
    subtitle:
      "Live map follows your every move. Pickup pin, rider profile, turn-by-turn directions — one tap each.",
  },
  {
    file: "1000536546.jpg",
    eyebrow: "Earnings, transparent",
    headline: "Know what you made.",
    subtitle:
      "Today, this week, this month. Daily breakdown, best-day callout, next payout — all in the same place.",
  },
  {
    file: "1000536547.jpg",
    eyebrow: "Every trip, on record",
    headline: "Your driving log.",
    subtitle:
      "Completed and cancelled trips with rider feedback, fares, and parish-to-parish details — always at your fingertips.",
  },
  {
    file: "1000536548.jpg",
    eyebrow: "TA-verified",
    headline: "Trusted by riders.",
    subtitle:
      "Your verified Transport Authority selfie, vehicle, and red plate show on every match. Riders know exactly who to look for.",
  },
  {
    file: "1000536549.jpg",
    eyebrow: "Instant settlement",
    headline: "Paid the moment you finish.",
    subtitle:
      "Trip earnings land in your Rajlo wallet on completion — no waiting, no cash, no chase.",
  },
];

const SLIDE_WIDTH = 1080;
const SLIDE_HEIGHT = 1920;
const FEATURE_WIDTH = 1024;
const FEATURE_HEIGHT = 500;

export default function PlayStoreComposerPage() {
  return (
    <main
      style={{
        background: "#202326",
        color: "white",
        minHeight: "100vh",
      }}
    >
      {/* Instructions strip — only renders in the browser; you don't
         screenshot this part. */}
      <header
        style={{
          background: "#111906",
          padding: "24px 32px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          Play Store screenshots — Rajlo Driver
        </h1>
        <p
          style={{
            marginTop: 8,
            fontSize: 14,
            color: "rgba(255,255,255,0.7)",
            lineHeight: 1.6,
          }}
        >
          Each slide below renders at the exact pixel size Play Store
          wants. To export: open Chrome DevTools (F12) →{" "}
          <strong>right-click</strong> the slide → <strong>Inspect</strong> →
          in DevTools{" "}
          <strong>right-click the highlighted element</strong> →{" "}
          <strong>Capture node screenshot</strong>. Repeat for each slide.
          Feature graphic at the bottom is 1024×500; phone screens are
          1080×1920.
        </p>
      </header>

      {/* Slides */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 48,
          padding: "48px 24px 96px",
        }}
      >
        {SLIDES.map((slide, i) => (
          <PhoneSlide key={slide.file} slide={slide} index={i + 1} />
        ))}

        <div
          style={{
            marginTop: 24,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Feature graphic · 1024×500
        </div>
        <FeatureGraphic />
      </div>
    </main>
  );
}

/**
 * One 1080×1920 portrait slide. Rajlo dark background, brand-red
 * accent glow, big white headline, the screenshot in a phone bezel
 * floated below.
 */
function PhoneSlide({ slide, index }: { slide: Slide; index: number }) {
  return (
    <section
      data-slide={index}
      style={{
        position: "relative",
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        overflow: "hidden",
        background:
          // Brand-dark gradient with a soft red bloom in the upper-
          // right and a deeper black in the bottom-left — gives the
          // canvas depth without being noisy behind the headline.
          "radial-gradient(120% 60% at 100% 0%, rgba(241,1,0,0.18) 0%, rgba(241,1,0,0) 55%)," +
          "radial-gradient(80% 60% at 0% 100%, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0) 60%)," +
          "linear-gradient(165deg, #1a1d10 0%, #111906 50%, #07090a 100%)",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        borderRadius: 8,
      }}
    >
      {/* Faint arc watermark in the bottom-right corner for brand presence. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: -240,
          bottom: -280,
          width: 900,
          height: 900,
          opacity: 0.06,
          color: "#f10100",
          pointerEvents: "none",
        }}
      >
        <LogoIcon height={900} className="" />
      </div>

      {/* Slide chrome — top row: brand mark + pagination */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 64,
          right: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#f10100",
              color: "white",
            }}
          >
            <LogoIcon height={28} />
          </span>
          <div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              Rajlo Driver
            </p>
            <p
              style={{
                marginTop: 2,
                fontSize: 18,
                fontWeight: 800,
                color: "white",
              }}
            >
              Let&apos;s go!
            </p>
          </div>
        </div>
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.08em",
          }}
        >
          {index} / {SLIDES.length}
        </span>
      </div>

      {/* Headline block */}
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 64,
          right: 64,
        }}
      >
        <span
          style={{
            display: "inline-block",
            padding: "8px 14px",
            borderRadius: 999,
            background: "rgba(241,1,0,0.18)",
            color: "#ff8a89",
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {slide.eyebrow}
        </span>
        <h2
          style={{
            marginTop: 22,
            fontSize: 92,
            fontWeight: 900,
            letterSpacing: "-0.035em",
            lineHeight: 1.02,
            color: "white",
          }}
        >
          {slide.headline}
        </h2>
        <p
          style={{
            marginTop: 26,
            fontSize: 28,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.82)",
            maxWidth: 880,
          }}
        >
          {slide.subtitle}
        </p>
      </div>

      {/* Phone frame containing the screenshot, anchored bottom-center.
         Frame dimensions tuned so the image fills it edge-to-edge —
         the phone bezel adds ~24px on each side. Drop shadow + a tiny
         tilt give it lift. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: -120,
          transform: "translateX(-50%)",
          width: 740,
          height: 1480,
          borderRadius: 64,
          padding: 14,
          background:
            "linear-gradient(180deg, #2b2e26 0%, #0e1108 100%)",
          boxShadow:
            "0 30px 90px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.06) inset",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 52,
            overflow: "hidden",
            background: "white",
          }}
        >
          <Image
            src={`/playstore/screenshots/${slide.file}`}
            alt={slide.headline}
            fill
            sizes="740px"
            style={{ objectFit: "cover", objectPosition: "top" }}
            unoptimized
            priority={index <= 2}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Feature graphic — 1024 × 500. Landscape banner that goes at the top
 * of the Play Store listing. Big brand mark on the left, headline +
 * tagline + a slim "Driver" pill on the right.
 */
function FeatureGraphic() {
  return (
    <section
      data-slide="feature"
      style={{
        position: "relative",
        width: FEATURE_WIDTH,
        height: FEATURE_HEIGHT,
        overflow: "hidden",
        background:
          "radial-gradient(80% 90% at 0% 0%, rgba(241,1,0,0.22) 0%, rgba(241,1,0,0) 55%)," +
          "linear-gradient(135deg, #1a1d10 0%, #111906 60%, #07090a 100%)",
        borderRadius: 8,
        boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        alignItems: "center",
        gap: 48,
        padding: "48px 64px",
        color: "white",
      }}
    >
      {/* Brand mark plate */}
      <div
        style={{
          display: "grid",
          placeItems: "center",
          width: 380,
          height: 380,
          borderRadius: 80,
          background: "#f10100",
          boxShadow:
            "0 20px 60px rgba(241,1,0,0.35), inset 0 0 0 2px rgba(255,255,255,0.08)",
        }}
      >
        <LogoIcon height={220} className="" />
      </div>

      {/* Right column */}
      <div>
        <span
          style={{
            display: "inline-block",
            padding: "6px 14px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.85)",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          For drivers · Jamaica
        </span>
        <h2
          style={{
            marginTop: 16,
            fontSize: 76,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1.0,
            color: "white",
          }}
        >
          Rajlo Driver
        </h2>
        <p
          style={{
            marginTop: 18,
            fontSize: 24,
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.78)",
            maxWidth: 540,
          }}
        >
          Verified red-plate driving. Live dispatch, transparent
          earnings, instant payouts. Drive with us.
        </p>
      </div>
    </section>
  );
}
