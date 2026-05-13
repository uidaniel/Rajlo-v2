import type { Metadata, Viewport } from "next";
import { Inter, DM_Sans } from "next/font/google";
import "./globals.css";
import { MotionProvider } from "@/components/motion-provider";
import { NativeDriverGuard } from "@/components/native-driver-guard";
import { NativePushHandler } from "@/components/native-push-handler";
import { NO_FOUC_SCRIPT } from "@/lib/preferences-client";

/**
 * Brand fonts (per Rajlo Brand Guidelines, Sept 2024):
 *   - Primary:   Avenir   (Light, Book, Roman, Medium, Heavy, Black)
 *   - Secondary: Kollectif (Regular, Bold)
 *
 * Both are paid/proprietary fonts not available on Google Fonts. The brand
 * book (p.35) explicitly authorizes a similar Avenir-style substitute when
 * the real font isn't available — we use Inter as the primary fallback and
 * DM Sans as the secondary fallback.
 *
 * To switch to real Avenir + Kollectif:
 *   1. Drop self-hosted .woff2 files in /public/fonts/ (Adobe Fonts kit, etc.)
 *   2. Uncomment the @font-face block in globals.css
 *   3. Replace `--font-primary` and `--font-secondary` here with the local refs
 */
const primary = Inter({
  variable: "--font-primary",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const secondary = DM_Sans({
  variable: "--font-secondary",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rajlo — Let's go!",
  description:
    "Rajlo is Jamaica's trusted rideshare platform. Verified red-plate drivers, transparent parish-based pricing, multi-seat bookings, and real-time tracking.",
  // Next.js auto-detects `app/icon.png` + `app/apple-icon.png` and
  // attaches them as <link rel="icon"> + <link rel="apple-touch-icon">
  // so we don't need to declare them here. The manifest link drives
  // PWA install (which iOS web push needs).
  manifest: "/manifest.webmanifest",
  // themeColor lives on the `viewport` export below — it moved out
  // of `metadata` in Next.js 14+ and Next will warn about it here.
};

/**
 * Explicit viewport config — fixes the iOS Safari "page loads zoomed
 * in" symptom. Without this, Safari falls back to a 980px viewport
 * heuristic + scales to fit, which renders Rajlo at ~50% zoom and
 * forces the user to pinch out manually on every page load.
 *
 * Settings:
 *  - `width: device-width` ties the layout viewport to the actual
 *    device width.
 *  - `initialScale: 1` opens at 100% zoom every time.
 *  - We deliberately DON'T set `userScalable: false` or
 *    `maximumScale: 1` — accessibility users with low vision still
 *    need pinch-to-zoom. The font-size: 16px rule on inputs in
 *    globals.css already prevents the auto-zoom-on-focus annoyance.
 *  - `viewportFit: cover` lets us paint behind the iPhone's
 *    notch / dynamic island; pages opt into safe-area insets where
 *    needed (the chat sheet "Cancel" pill already does).
 *  - Theme colour is duplicated here so the iOS / Android status
 *    bar tints brand-red when Rajlo opens from the home screen.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f10100",
  // Tells Chrome / Edge on Android to resize the layout viewport
  // when the on-screen keyboard appears. Combined with the
  // VisualViewport API in the chat sheet, this keeps the message
  // composer above the keyboard on every mobile browser instead of
  // hiding behind it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${primary.variable} ${secondary.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-background text-foreground"
        suppressHydrationWarning
      >
        {/* No-FOUC theme bootstrap: synchronous read from localStorage
           that applies `data-theme` to <html> before any CSS paints,
           so dark-mode users never flash white on navigation. */}
        <script
          dangerouslySetInnerHTML={{ __html: NO_FOUC_SCRIPT }}
        />
        <MotionProvider>
          {/* No-op on web. In the Capacitor driver app it snaps any
              off-portal navigation back to /driver. */}
          <NativeDriverGuard />
          {/* No-op on web. In the Capacitor app it sets up the
              high-importance notification channel + routes taps to
              the right page via the FCM payload's `url` field. */}
          <NativePushHandler />
          <div className="min-h-screen">{children}</div>
        </MotionProvider>
      </body>
    </html>
  );
}
