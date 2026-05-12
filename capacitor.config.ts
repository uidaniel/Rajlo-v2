import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for the Rajlo Driver native shell.
 *
 * This wraps the existing Next.js web app in a thin native container
 * so we can:
 *   - Stream GPS reliably in the background (the killer feature —
 *     browser geolocation pauses when the phone screen locks).
 *   - Deliver native push notifications for new ride requests.
 *   - Show in the app stores.
 *
 * Architecture: the native app is a WebView that loads the live
 * driver portal (`server.url`) at startup. All of the existing
 * Next.js code — pages, API routes, auth, proxy — runs on the same
 * server. The native layer only kicks in for background GPS + push.
 *
 * The bundled webDir (`capacitor-shell/`) is shown if the remote URL
 * fails to load (rare — usually only when offline at first launch).
 */

const config: CapacitorConfig = {
  appId: "com.rajlo.driver",
  appName: "Rajlo Driver",
  // Minimal offline-fallback shell. The real UI loads from server.url.
  webDir: "capacitor-shell",
  // Loading the live Next.js app instead of bundling. The driver
  // portal logic, auth gates, and proxy all live there.
  //
  // Pre-launch this points at the Vercel preview URL. Swap to
  // `https://driver.rajlo.com` once DNS is wired on launch day.
  server: {
    url: "https://rajlo-v2.vercel.app/driver",
    // `cleartext: false` blocks plaintext HTTP — defends against
    // anyone trying to redirect the app at an HTTP fake.
    cleartext: false,
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#f10100", // Rajlo red
      androidSplashResourceName: "splash",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Brand-red status bar to match the in-app top strip.
      backgroundColor: "#f10100",
      style: "DARK",
      // Without this Android draws the WebView edge-to-edge under the
      // status bar, hiding the top of the page behind the battery/wifi
      // icons. Setting it false reserves the status bar's height for
      // itself so app content always starts below.
      overlaysWebView: false,
    },
    BackgroundGeolocation: {
      // Background geolocation is the whole reason we wrap. The plugin
      // posts a sticky notification while tracking on Android (required
      // by the foreground service). Copy below shows up there.
      backgroundMessage: "Rajlo is sharing your location for an active trip.",
      backgroundTitle: "Rajlo Driver",
      // Re-prompt the driver if they revoke permissions.
      requestPermissions: true,
      // Minimum accuracy to accept a fix, in metres. iOS/Android
      // sometimes return wild jumps; <100m keeps the rider's marker
      // believable.
      distanceFilter: 10,
    },
  },
  android: {
    // Allow the WebView to load mixed-origin assets (Maps, etc).
    allowMixedContent: false,
    // Match the launch screen colour so there's no flash of white
    // between the splash and the WebView painting.
    backgroundColor: "#f10100",
  },
};

export default config;
