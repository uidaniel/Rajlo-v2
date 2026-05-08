/**
 * Browser-side platform detection — used for surfacing OS-specific
 * UX hints (iOS web push needs PWA install, iOS Settings paths for
 * blocked location, etc.).
 *
 * UA sniffing is fragile in general but here it's gated to "should
 * we show this iOS-specific helper?" — false negatives degrade to
 * the generic message, false positives just show iOS instructions
 * to a non-iOS user (visible only to people who explicitly enabled
 * a setting that's failing). Both fail safe.
 */

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  // iPad on modern iOS reports as macOS Safari but with touch — detect
  // both the legacy mobile UA AND the iPad-on-iOS ambiguity.
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOS =
    ua.includes("Macintosh") &&
    typeof navigator !== "undefined" &&
    "maxTouchPoints" in navigator &&
    (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints !==
      undefined &&
    ((navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ??
      0) > 1;
  return iOSDevice || iPadOS;
}

export function isSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  // Safari includes "Safari" but NOT "CriOS" (Chrome on iOS) or
  // "FxiOS" (Firefox on iOS) or "EdgiOS" — those wrap WebKit but
  // route via their own network stack.
  return (
    /Safari/.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua) &&
    !/Chrome|Chromium/.test(ua)
  );
}

/**
 * True when the page is running as an installed PWA (added to home
 * screen on iOS, or installed via the install prompt on Chrome/Edge).
 * iOS web push API only works in this mode.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS-specific (legacy non-standard): navigator.standalone
  const navStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone;
  if (navStandalone === true) return true;
  // Cross-browser: matchMedia
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return true;
  return false;
}

/** Convenience: iOS web push only works in standalone (PWA) mode. */
export function iosNeedsPwaInstall(): boolean {
  return isIOS() && !isStandalone();
}
