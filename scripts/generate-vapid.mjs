/**
 * Run once: `node scripts/generate-vapid.mjs`
 *
 * Generates a VAPID keypair and prints the env vars to drop into
 * `.env.local`. The PUBLIC key has to be available on the browser
 * (NEXT_PUBLIC_*) so the page can use it as `applicationServerKey`
 * when subscribing.
 *
 * Generate ONCE — every time you regenerate, every existing
 * push subscription becomes invalid and users have to re-subscribe.
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\nAdd these to your .env.local (and Vercel project env):\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:ops@rajlo.com\n`);

console.log(
  "Notes:",
  "\n  • PUBLIC key is safe to ship to the browser; PRIVATE key stays on the server.",
  "\n  • Don't regenerate after going live — it invalidates every existing subscription.",
  "\n  • Restart `npm run dev` after editing .env.local for the new vars to take effect.\n",
);
