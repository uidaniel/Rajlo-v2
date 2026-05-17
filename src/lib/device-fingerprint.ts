/**
 * Client-side device fingerprinting.
 *
 * Computes a stable hash from the browser/device signals that don't
 * change between sessions on the same device. Submitted to
 * `/api/device/fingerprint`, where matching hashes across different
 * accounts become the multi-account / fraud-ring signal feeding the
 * risk score.
 *
 * This is a fraud signal, NOT tracking — it carries no PII and isn't
 * used to follow a user around; it only answers "have we seen this
 * device on another account?".
 */

export type DeviceFingerprint = {
  /** Stable random id persisted in this device's localStorage. */
  deviceId: string;
  /** SHA-256 of the stable device signal set. */
  fingerprintHash: string;
  deviceType: string;
  osVersion: string;
  appVersion: string;
};

const DEVICE_ID_KEY = "rajlo_device_id";

function getOrCreateDeviceId(): string {
  try {
    let id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Coarse device class from the user-agent. */
function deviceTypeFromUA(ua: string): string {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

/** Coarse OS label from the user-agent. */
function osFromUA(ua: string): string {
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Unknown";
}

/**
 * Compute this device's fingerprint. Returns null in environments
 * without the Web Crypto API (the caller treats that as "no signal").
 */
export async function computeDeviceFingerprint(): Promise<DeviceFingerprint | null> {
  if (
    typeof window === "undefined" ||
    !window.crypto?.subtle ||
    typeof navigator === "undefined"
  ) {
    return null;
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
  };
  const screenSig =
    typeof screen !== "undefined"
      ? `${screen.width}x${screen.height}x${screen.colorDepth}`
      : "";
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";

  // Stable signals only — nothing that changes session to session.
  const signal = [
    nav.userAgent,
    nav.language,
    screenSig,
    timezone,
    String(nav.hardwareConcurrency ?? ""),
    String(nav.deviceMemory ?? ""),
  ].join("|");

  return {
    deviceId: getOrCreateDeviceId(),
    fingerprintHash: await sha256Hex(signal),
    deviceType: deviceTypeFromUA(nav.userAgent),
    osVersion: osFromUA(nav.userAgent),
    appVersion: "web",
  };
}
