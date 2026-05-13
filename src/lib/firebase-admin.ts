import "server-only";
import type { App } from "firebase-admin/app";

/**
 * Lazy-initialised Firebase Admin SDK. Holds at most one App instance
 * per Node process; calling `getFirebaseAdmin()` multiple times is
 * cheap (returns the cached App after the first call).
 *
 * Configuration is split across three env vars rather than a single
 * JSON blob because Vercel doesn't love multi-line env values:
 *
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY  (with literal `\n` in the env value —
 *                          we replace them with real newlines at init)
 *
 * Get these from Firebase Console → Project Settings → Service
 * Accounts → "Generate new private key". The downloaded JSON has
 * `project_id`, `client_email`, `private_key` fields — paste each
 * into the matching env var.
 *
 * Returns null when env vars aren't set so dev environments without
 * Firebase keys keep working (FCM sends become no-ops, web-push and
 * email still go through).
 */

let cachedApp: App | null | undefined = undefined;
type AppMaybe = App | null;

export async function getFirebaseAdmin(): Promise<AppMaybe> {
  if (cachedApp !== undefined) return cachedApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    cachedApp = null;
    return null;
  }

  // Vercel stores private keys with literal `\n` strings — unescape
  // them into real newlines or the PEM parser will reject it.
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  const { initializeApp, getApps, cert } = await import("firebase-admin/app");

  // initializeApp throws if called twice with the same name. Use the
  // module-level getApps() to bail on a hot-reload re-import.
  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0];
    return cachedApp;
  }

  cachedApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return cachedApp;
}
