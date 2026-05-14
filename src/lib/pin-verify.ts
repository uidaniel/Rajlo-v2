/**
 * PIN Verify Ride — server-side helpers.
 *
 * The rider toggles a 4-digit PIN-at-pickup requirement in settings.
 * When they request a ride and their prefs say "always" — or "night_only"
 * and the request lands in Jamaica's night window — we generate a PIN
 * on the ride row. The driver must enter it before the trip can move
 * past `arrived`. After 3 wrong entries the ride auto-cancels.
 *
 * All time math here uses Jamaica's local time (UTC-5, no DST) so the
 * night window is consistent regardless of the server's clock zone.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Inclusive start hour of the night-only window (21:00 JM time). */
export const PIN_NIGHT_START_HOUR_JM = 21;
/** Exclusive end hour of the night-only window (06:00 JM time). */
export const PIN_NIGHT_END_HOUR_JM = 6;

/** Auto-cancel threshold. Reached the moment the 3rd wrong entry posts. */
export const PIN_MAX_ATTEMPTS = 3;

export type PinVerifyMode = "always" | "night_only";

/**
 * Generate a fresh 4-digit code. We allow leading zeros and don't filter
 * 1234 / 0000 / 1111 — the security model is "rider reads PIN from their
 * screen, driver types it in"; pattern strength doesn't matter when the
 * adversary doesn't have remote brute-force access (they'd need physical
 * possession of the rider's phone, in which case PIN strength isn't what
 * saves you).
 */
export function generatePinCode(): string {
  const n = Math.floor(Math.random() * 10_000);
  return n.toString().padStart(4, "0");
}

/**
 * Jamaica is UTC-5 year-round (no daylight saving). Returns the local
 * hour for "now" in 0–23 form.
 */
function jamaicaHourNow(now: Date = new Date()): number {
  // toLocaleString with timezone is more robust than fixed-offset math
  // (no leap-second / DST edge cases), and Jamaica timezone is ubiquitous.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Jamaica",
    hour: "2-digit",
    hour12: false,
  });
  return Number(fmt.format(now));
}

/** True if the current Jamaica local time falls in the configured night
 *  window (21:00–06:00). */
export function isJamaicaNightNow(now: Date = new Date()): boolean {
  const h = jamaicaHourNow(now);
  return h >= PIN_NIGHT_START_HOUR_JM || h < PIN_NIGHT_END_HOUR_JM;
}

/**
 * Decide whether a fresh ride needs a PIN based on the rider's prefs
 * and the current Jamaica time. Returns the PIN to write to the row,
 * or null if no PIN is required.
 */
export function pinForRide(
  enabled: boolean,
  mode: PinVerifyMode,
  now: Date = new Date(),
): string | null {
  if (!enabled) return null;
  if (mode === "always") return generatePinCode();
  if (mode === "night_only" && isJamaicaNightNow(now)) return generatePinCode();
  return null;
}

/**
 * Convenience for the rider-rides POST route. Looks up the rider's
 * pin prefs and returns the PIN (or null) to stamp on the ride row.
 * Defaults to "off" if the columns aren't present yet (pre-migration
 * environments) — safe degradation.
 */
export async function resolveRidePin(
  supabase: SupabaseClient,
  riderId: string,
  now: Date = new Date(),
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("pin_verify_enabled, pin_verify_mode")
    .eq("id", riderId)
    .maybeSingle();
  if (!data) return null;
  const enabled = Boolean(
    (data as { pin_verify_enabled?: boolean }).pin_verify_enabled,
  );
  const rawMode = (data as { pin_verify_mode?: string }).pin_verify_mode;
  const mode: PinVerifyMode =
    rawMode === "night_only" ? "night_only" : "always";
  return pinForRide(enabled, mode, now);
}
