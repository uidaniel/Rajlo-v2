"use client";

import { useEffect } from "react";

/**
 * Fires a single ping to /api/admin/security/beacon when the admin
 * portal shell mounts, so the security dashboard has an access-history
 * record (IP + user-agent + timestamp) for the session. The endpoint
 * de-dupes to at most one row per admin per hour. Renders nothing.
 */
export function AdminAccessBeacon() {
  useEffect(() => {
    fetch("/api/admin/security/beacon", { method: "POST" }).catch(() => {
      /* best-effort — a missed beacon is not worth surfacing */
    });
  }, []);
  return null;
}
