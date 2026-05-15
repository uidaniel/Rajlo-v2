"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";
import type { Place } from "@/lib/jamaica";

/**
 * One-tap saved-destination chip strip for the rider booking screen.
 *
 * Fetches /api/rider/saved-places once on mount, renders the rider's
 * saved entries as small pill chips, and calls `onPick` with a
 * Place-shaped payload when tapped.
 *
 * Pick policy lives in the parent (request page): typically "fill
 * pickup if empty, otherwise dropoff". This component only delivers
 * a Place — it doesn't know about pickup/dropoff state.
 *
 * Empty state renders a tiny "Save your home + work for one-tap
 * pickup" prompt that links to /rider/saved-places. Keeps the
 * feature discoverable for new riders without nagging.
 */

type Kind = "home" | "work" | "office" | "school" | "gym" | "other";

type SavedPlace = {
  id: string;
  label: string;
  kind: Kind;
  placeName: string;
  placeAddress: string;
  lat: number;
  lng: number;
  parish: string | null;
  placeId: string | null;
};

const ICON: Record<Kind, IconName> = {
  home: "home",
  work: "users",
  office: "users",
  school: "shield",
  gym: "activity",
  other: "map-pin",
};

export function SavedPlaceChips({
  onPick,
}: {
  onPick: (place: Place) => void;
}) {
  const [places, setPlaces] = useState<SavedPlace[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/rider/saved-places");
        if (!res.ok) return;
        const json = (await res.json()) as { places: SavedPlace[] };
        if (!cancelled) setPlaces(json.places ?? []);
      } catch {
        if (!cancelled) setPlaces([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Still loading — render a thin placeholder strip so the layout
  // doesn't jump when the data arrives.
  if (places == null) {
    return (
      <div className="flex gap-2">
        <span className="h-9 w-24 animate-pulse rounded-full bg-surface-soft" />
        <span className="h-9 w-20 animate-pulse rounded-full bg-surface-soft" />
        <span className="h-9 w-24 animate-pulse rounded-full bg-surface-soft" />
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <Link
        href="/rider/saved-places"
        className="inline-flex items-center gap-2 rounded-full border border-dashed border-line bg-surface-soft px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-rajlo-red/40 hover:text-rajlo-red"
      >
        <Icon name="plus-circle" className="h-3.5 w-3.5" />
        Save your home + work for one-tap pickup
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {places.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() =>
            onPick({
              name: p.placeName,
              address: p.placeAddress,
              lat: p.lat,
              lng: p.lng,
              parish: p.parish,
              // The Place type requires a string here; saved places
              // without a Google `place_id` (rare — most are picked via
              // Google Autocomplete) fall back to a synthetic marker
              // so downstream code can still tell it's a real entry.
              placeId: p.placeId ?? `saved:${p.id}`,
            })
          }
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2 text-xs font-bold text-foreground shadow-sm transition-colors hover:border-rajlo-red/40 hover:bg-primary-soft hover:text-rajlo-red"
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-soft text-rajlo-red">
            <Icon name={ICON[p.kind]} className="h-3 w-3" />
          </span>
          <span className="max-w-28 truncate">{p.label}</span>
        </button>
      ))}
      <Link
        href="/rider/saved-places"
        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-2 text-xs font-bold text-muted hover:text-rajlo-red"
      >
        <Icon name="plus-circle" className="h-3.5 w-3.5" />
        Manage
      </Link>
    </div>
  );
}
