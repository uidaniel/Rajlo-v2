import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import {
  consentRoleFromProfileRole,
  getOutstandingLegalDocuments,
} from "@/lib/legal-consent";
import { getAllEffectiveLegalDocuments } from "@/lib/legal-store";
import type { EffectiveLegalDocument } from "@/lib/legal-store";

/**
 * GET /api/legal/status
 *
 * Returns the signed-in user's legal-consent state:
 *   - role:        their consent role ("rider" | "driver" | null)
 *   - required:    every document their role must accept
 *   - outstanding: the subset they have NOT accepted at the current
 *                  version — non-empty means a consent gate should
 *                  block them until they accept.
 *
 * The rider/driver portals + the consent gate poll this on entry.
 */

function wire(docs: EffectiveLegalDocument[]) {
  return docs.map((d) => ({
    key: d.key,
    title: d.title,
    version: d.version,
    summary: d.summary,
  }));
}

export async function GET() {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = consentRoleFromProfileRole(
    (profile as { role?: string } | null)?.role,
  );

  // Internal staff (admin / safety officer) aren't gated.
  if (!role) {
    return NextResponse.json({ role: null, required: [], outstanding: [] });
  }

  const all = await getAllEffectiveLegalDocuments();
  const required = all.filter(
    (doc) => doc.audience === "everyone" || doc.audience === role,
  );
  const outstanding = await getOutstandingLegalDocuments(
    supabase,
    user.id,
    role,
  );

  return NextResponse.json({
    role,
    required: wire(required),
    outstanding: wire(outstanding),
  });
}
