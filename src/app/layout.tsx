import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import "./globals.css";
import { MotionProvider } from "@/components/motion-provider";

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
  themeColor: "#f10100",
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
        <MotionProvider>
          <div className="min-h-screen">{children}</div>
        </MotionProvider>
      </body>
    </html>
  );
}
