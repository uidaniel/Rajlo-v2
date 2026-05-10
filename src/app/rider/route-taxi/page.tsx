"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/skeleton";

/**
 * /rider/route-taxi — Redirect surface.
 *
 * Originally this was a "browse all 466 corridors" page, but the mode
 * picker now lives inside /rider/request after pickup + dropoff are
 * selected (the matcher figures out which corridor covers the trip).
 * So this URL is redundant for the rider — but keep it alive so deep
 * links / bookmarks land somewhere useful:
 *
 *   • If the rider has an active hail   → /rider/route-taxi/live?id=
 *   • Otherwise                         → /rider/request
 */
export default function RiderRouteTaxiCatalogueRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/rider/route-taxi/hails/active");
        if (cancelled) return;
        if (res.ok) {
          const json = (await res.json()) as { hail: { id: string } | null };
          if (json.hail) {
            router.replace(`/rider/route-taxi/live?id=${json.hail.id}`);
            return;
          }
        }
      } catch {
        /* fall through to /request */
      }
      router.replace("/rider/request");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="space-y-3">
      <Skeleton className="h-44 w-full" rounded="3xl" />
      <Skeleton className="h-24 w-full" rounded="2xl" />
    </div>
  );
}
