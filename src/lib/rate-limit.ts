import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight in-memory token-bucket rate limiter for API routes.
 *
 * Honest scope: this lives in module-level memory, so on a serverless
 * platform that spins up multiple worker instances per region, a
 * determined attacker can spread requests across instances and beat
 * the limit. It still raises the cost meaningfully (single bot from
 * a single IP gets stopped fast) and is enough first-defense for the
 * launch. Swap in Upstash / Vercel KV for distributed enforcement
 * once we hit real abuse — keep this module's surface stable so the
 * call sites don't have to change.
 *
 * Buckets are keyed by `{prefix}:{identifier}` where identifier is
 * usually the client IP. We also expose a per-user variant for routes
 * where the caller is authenticated and we'd rather throttle by user
 * id (so multiple devices on the same NAT don't eat each other's
 * quota).
 */

type Bucket = {
  /** Window start, ms since epoch. */
  windowStart: number;
  /** Hits in the current window. */
  hits: number;
};

const BUCKETS = new Map<string, Bucket>();

/** Drop expired buckets every minute so the Map can't grow unbounded. */
let sweepStarted = false;
function startSweep() {
  if (sweepStarted) return;
  sweepStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of BUCKETS) {
      // Anything not touched in the last 5 minutes is dead weight.
      if (now - b.windowStart > 5 * 60_000) BUCKETS.delete(k);
    }
  }, 60_000).unref?.();
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

/**
 * Record a hit and return whether the caller is over budget. Pure
 * synchronous — no awaits, safe to call from the very top of any
 * route handler.
 */
export function checkRateLimit(opts: {
  /** Bucket prefix — choose something unique per endpoint family
   *  (e.g. `auth:check-email`, `wallet:transfer-initiate`). */
  key: string;
  /** Max hits allowed in the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}): RateLimitResult {
  startSweep();
  const now = Date.now();
  let bucket = BUCKETS.get(opts.key);
  if (!bucket || now - bucket.windowStart >= opts.windowMs) {
    bucket = { windowStart: now, hits: 0 };
    BUCKETS.set(opts.key, bucket);
  }
  bucket.hits += 1;
  if (bucket.hits > opts.limit) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((opts.windowMs - (now - bucket.windowStart)) / 1000),
    );
    return { ok: false, retryAfterSec };
  }
  return { ok: true, remaining: opts.limit - bucket.hits };
}

/** Best-effort client IP from common proxy headers. */
export function clientIp(request: NextRequest | Request): string {
  const headers =
    "headers" in request
      ? (request.headers as Headers)
      : new Headers((request as Request).headers);
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/**
 * Convenience wrapper: enforces a per-IP limit and, if exceeded,
 * returns a NextResponse 429 with a `Retry-After` header. Caller
 * just early-returns the response.
 *
 *   const limited = enforceIpRateLimit(request, { prefix: "auth:check-email", limit: 10, windowMs: 60_000 });
 *   if (limited) return limited;
 */
export function enforceIpRateLimit(
  request: NextRequest | Request,
  opts: { prefix: string; limit: number; windowMs: number },
): NextResponse | null {
  const ip = clientIp(request);
  const result = checkRateLimit({
    key: `${opts.prefix}:${ip}`,
    limit: opts.limit,
    windowMs: opts.windowMs,
  });
  if (result.ok) return null;
  return NextResponse.json(
    {
      error: `Too many requests. Try again in ${result.retryAfterSec}s.`,
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSec) },
    },
  );
}

/** Same idea but keyed by a user id — useful when the caller is authenticated. */
export function enforceUserRateLimit(
  userId: string,
  opts: { prefix: string; limit: number; windowMs: number },
): NextResponse | null {
  const result = checkRateLimit({
    key: `${opts.prefix}:user:${userId}`,
    limit: opts.limit,
    windowMs: opts.windowMs,
  });
  if (result.ok) return null;
  return NextResponse.json(
    {
      error: `Too many requests. Try again in ${result.retryAfterSec}s.`,
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSec) },
    },
  );
}
