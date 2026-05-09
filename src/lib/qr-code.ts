/**
 * QR pay helpers — code generation + payload formatting.
 *
 * Codes are 8 chars long over a 31-char alphabet that drops the
 * visually-ambiguous 0/O/1/I/L. That's 31^8 ≈ 8.5 trillion possible
 * codes — collision risk is negligible at every realistic scale, and
 * the DB unique constraint on `qr_charges.code` is the safety net.
 *
 * Codes are typeable as a fallback when the rider's camera scan
 * fails — an 8-char alphanumeric is short enough to enter on a
 * phone keyboard without errors.
 */

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

/** Generate a random 8-char QR pay code. Cryptographically random. */
export function generateQrCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/**
 * Build the deep-link URL embedded in the QR. Modern phone cameras
 * detect URL-shaped QRs and offer to open them directly — that takes
 * the rider straight to the confirm screen if they're signed in, or
 * to the login wall otherwise (with the code preserved through the
 * auth flow via the existing `?next=` pattern).
 */
export function qrPayloadFor(origin: string, code: string): string {
  // Trim trailing slash so we never produce `https://x.com//rider/...`
  const base = origin.replace(/\/+$/, "");
  return `${base}/rider/qr-pay?code=${encodeURIComponent(code)}`;
}

/** How long a pending QR charge stays valid before auto-expiring. */
export const QR_CHARGE_TTL_MINUTES = 10;
