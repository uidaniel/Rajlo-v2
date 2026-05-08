import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * GET / PATCH /api/me/profile
 *
 * Single endpoint for self-edit of fields any user can change on
 * their public profile, regardless of role:
 *
 *   - full_name      (display name shown to drivers / other riders)
 *   - avatar_url     (uploaded via the avatars bucket; client passes
 *                     the public URL after a successful upload)
 *
 * Email isn't touched here — changing email on the auth user requires
 * its own re-verification flow which is its own bigger feature. The
 * email shown on the profile page is read-only for now.
 *
 * Drivers also have role-specific fields (vehicle, plate, phone,
 * compliance) that live behind /api/driver/me. This endpoint only
 * covers the cross-role profile bits.
 */

export async function GET() {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    profile: {
      id: user.id,
      email: user.email ?? null,
      fullName: data?.full_name ?? null,
      avatarUrl: data?.avatar_url ?? null,
      role: data?.role ?? null,
    },
  });
}

type PatchBody = {
  fullName?: unknown;
  avatarUrl?: unknown;
};

export async function PATCH(request: Request) {
  const auth = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const update: Record<string, string | null> = {};

  if (body.fullName !== undefined) {
    if (body.fullName === null || body.fullName === "") {
      update.full_name = null;
    } else if (typeof body.fullName === "string") {
      const trimmed = body.fullName.trim();
      if (trimmed.length === 0) {
        return NextResponse.json(
          { error: "Name can't be empty." },
          { status: 400 },
        );
      }
      if (trimmed.length > 80) {
        return NextResponse.json(
          { error: "Name is too long (max 80 chars)." },
          { status: 400 },
        );
      }
      update.full_name = trimmed;
    } else {
      return NextResponse.json(
        { error: "Invalid name." },
        { status: 400 },
      );
    }
  }

  if (body.avatarUrl !== undefined) {
    if (body.avatarUrl === null || body.avatarUrl === "") {
      update.avatar_url = null;
    } else if (typeof body.avatarUrl === "string") {
      // Loose URL sanity-check — must look like a real URL. The
      // avatar pipeline only ever produces Supabase storage URLs, so
      // this is a defence-in-depth against an attacker passing a
      // non-image URL.
      if (
        !body.avatarUrl.startsWith("http://") &&
        !body.avatarUrl.startsWith("https://")
      ) {
        return NextResponse.json(
          { error: "Invalid avatar URL." },
          { status: 400 },
        );
      }
      update.avatar_url = body.avatarUrl;
    } else {
      return NextResponse.json(
        { error: "Invalid avatar URL." },
        { status: 400 },
      );
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
