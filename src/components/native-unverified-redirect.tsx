"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native";

/**
 * Drop into /driver/pending and /driver/onboarding pages. If the
 * driver is running inside the Capacitor native app, bounces them to
 * /driver/verify-on-web — they need a real browser to upload docs +
 * finish onboarding, and the native shell is reserved for verified
 * drivers anyway.
 *
 * No-op on web.
 */
export function NativeUnverifiedRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (isNativeApp()) {
      router.replace("/driver/verify-on-web");
    }
  }, [router]);

  return null;
}
