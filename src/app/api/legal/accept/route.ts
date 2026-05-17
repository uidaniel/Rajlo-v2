import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { getAllEffectiveLegalDocuments } from "@/lib/legal-store";

/**
 * POST /api/legal/accept
 *
 * Records that the signed-in user has accepted one or more policies.
 * This is the legally load-bearing write — it stamps each acceptance
 * with the document version, a server timestamp, the client IP, and
 * the user-agent, so RAJLO can later prove exactly what was agreed,
 * when, and from what device.
 *
 * Body: { keys: string[], context?: string }
 *   - keys:    document keys from src/lib/legal-documents.ts
 *   - context: where the acceptance happened ("signup",
 *              "reacceptance", "driver-onboarding"); audit metadata.
 *
 * The current version of each key is resolved server-side from the
 * registry — the client cannot forge a version. Unknown keys are
 * skipped. Writes are idempotent: the (user, doc, version) unique
 * index + ignoreDuplicates means a double-submit can't create
 * duplicate consent rows.
 */

type Body = { keys?: unknown; context?: unknown };

/** Pull the client IP from the proxy headers Vercel sets. */
function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    // x-forwarded-for is "client, proxy1, proxy2" — the first is the
    // real client.
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

/** Coarse device class from the user-agent — stored on the consent row
 *  so the evidence shows what kind of device the user accepted from. */
function platformFromUserAgent(ua: string | null): string {
  if (!ua) return "unknown";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "web";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const keys = Array.isArray(body.keys)
    ? body.keys.filter((k): k is string => typeof k === "string")
    : [];
  const context =
    typeof body.context === "string" && body.context.trim()
      ? body.context.trim().slice(0, 64)
      : "signup";

  if (keys.length === 0) {
    return NextResponse.json(
      { error: "No policy keys provided." },
      { status: 400 },
    );
  }

  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;
  const platform = platformFromUserAgent(userAgent);

  // Resolve each key to its CURRENT effective version (the
  // admin-published DB copy, or the baseline). The client never
  // supplies the version OR the content hash — both are resolved
  // server-side so a user can't pin an acceptance to stale wording.
  const effective = await getAllEffectiveLegalDocuments();
  const byKey = new Map(effective.map((doc) => [doc.key, doc]));
  const rows = keys
    .map((key) => byKey.get(key))
    .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
    .map((doc) => ({
      user_id: user.id,
      doc_key: doc.key,
      version: doc.version,
      content_hash: doc.contentHash,
      ip_address: ip,
      user_agent: userAgent,
      platform,
      context,
    }));

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "None of the provided keys match a known policy." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("legal_acceptances")
    .upsert(rows, {
      onConflict: "user_id,doc_key,version",
      ignoreDuplicates: true,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recorded: rows.length });
}
