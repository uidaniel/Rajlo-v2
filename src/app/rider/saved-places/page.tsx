"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { Icon, type IconName } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp } from "@/components/anim";
import { Skeleton } from "@/components/skeleton";
import { PlacesAutocomplete } from "@/components/places-autocomplete";
import { type Place } from "@/lib/jamaica";

/**
 * Rider Saved Places — manage Home / Work / Office / customs.
 *
 * Surfaces on the rider booking screen as one-tap chips for pickup or
 * drop-off. Backed by /api/rider/saved-places (CRUD).
 *
 * Canonical kinds (home / work / office / school / gym) are unique per
 * rider — the API will 409 if they try to save two "Home"s. Custom
 * labels under `kind: "other"` are unconstrained.
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

const KIND_META: Record<Kind, { icon: IconName; defaultLabel: string }> = {
  home: { icon: "home", defaultLabel: "Home" },
  work: { icon: "users", defaultLabel: "Work" },
  office: { icon: "users", defaultLabel: "Office" },
  school: { icon: "shield", defaultLabel: "School" },
  gym: { icon: "activity", defaultLabel: "Gym" },
  other: { icon: "map-pin", defaultLabel: "Custom" },
};

export default function SavedPlacesPage() {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/rider/saved-places");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { places: SavedPlace[] };
      setPlaces(json.places ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load saved places");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDelete = async (id: string) => {
    // Optimistic remove — restore if the server rejects.
    const prev = places;
    setPlaces((list) => list.filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/rider/saved-places/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      setPlaces(prev);
      setError(e instanceof Error ? e.message : "Couldn't remove place");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-2 md:px-3 md:py-8">
      {/* Hero */}
      <FadeUp>
        <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-6 text-white shadow-xl shadow-rajlo-black/30 md:p-8">
          <ArcWatermark
            size={360}
            variant="red"
            className="absolute -right-20 -bottom-24"
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                Quick destinations
              </p>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                Saved places
              </h1>
              <p className="mt-1 max-w-md text-sm text-white/75">
                One-tap pickup or drop-off for the places you go to all the
                time. Home, Office, the gym, your mum&apos;s house — name them
                anything you like.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-rajlo-red px-5 py-3 text-sm font-bold shadow-lg shadow-rajlo-red/30 transition-transform hover:-translate-y-0.5 hover:bg-primary-hover sm:self-auto"
            >
              <Icon name="plus-circle" className="h-4 w-4" />
              Add place
            </button>
          </div>
        </div>
      </FadeUp>

      {error && (
        <div className="rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm font-semibold text-rajlo-red">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" rounded="2xl" />
          ))}
        </div>
      ) : places.length === 0 ? (
        <FadeUp delay={0.05}>
          <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-rajlo-red">
              <Icon name="map-pin" className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-xl font-extrabold tracking-tight">
              No saved places yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Save your common destinations and they&apos;ll appear as
              one-tap chips when you book a ride.
            </p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-rajlo-red px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 transition-transform hover:-translate-y-0.5"
            >
              <Icon name="plus-circle" className="h-4 w-4" />
              Add your first place
            </button>
          </div>
        </FadeUp>
      ) : (
        <div className="space-y-3">
          {places.map((p, i) => (
            <FadeUp key={p.id} delay={0.04 + i * 0.02}>
              <PlaceRow place={p} onDelete={() => handleDelete(p.id)} />
            </FadeUp>
          ))}
        </div>
      )}

      {/* Back link */}
      <FadeUp delay={0.2}>
        <Link
          href="/rider/settings"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-rajlo-red"
        >
          <Icon name="chevron-left" className="h-3 w-3" />
          Back to settings
        </Link>
      </FadeUp>

      <AddPlaceDialog
        open={addOpen}
        existingKinds={
          new Set(places.map((p) => p.kind).filter((k) => k !== "other"))
        }
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false);
          void refresh();
        }}
      />
    </div>
  );
}

function PlaceRow({
  place,
  onDelete,
}: {
  place: SavedPlace;
  onDelete: () => void;
}) {
  const meta = KIND_META[place.kind];
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-rajlo-red">
        <Icon name={meta.icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold">{place.label}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {place.placeName} · {place.placeAddress}
        </p>
        {place.parish && (
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
            {place.parish}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Remove"
        className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-primary-soft hover:text-rajlo-red"
      >
        <Icon name="x" className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ─────────── Add place dialog ─────────── */

function AddPlaceDialog({
  open,
  existingKinds,
  onClose,
  onSaved,
}: {
  open: boolean;
  existingKinds: Set<Kind>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<Kind>("home");
  const [label, setLabel] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset whenever the dialog opens — picking up where you left off
  // would be confusing if the form had stale values from a previous
  // create attempt.
  useEffect(() => {
    if (!open) return;
    // Pick the first canonical kind the rider hasn't saved yet, or
    // fall back to "other" if they've already got all of them.
    const firstUnused = (
      ["home", "work", "office", "school", "gym"] as const
    ).find((k) => !existingKinds.has(k));
    const nextKind = firstUnused ?? "other";
    setKind(nextKind);
    setLabel(KIND_META[nextKind].defaultLabel);
    setPlace(null);
    setError(null);
    setSaving(false);
  }, [open, existingKinds]);

  const handleSave = async () => {
    if (!place) {
      setError("Pick a location first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/rider/saved-places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          kind,
          placeName: place.name,
          placeAddress: place.address,
          lat: place.lat,
          lng: place.lng,
          parish: place.parish ?? null,
          placeId: place.placeId ?? null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save place");
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!place && label.trim().length > 0 && !saving;

  return (
    <AnimatePresence>
      {open && (
        <m.div
          key="add-place"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-place-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          onClick={() => {
            if (!saving) onClose();
          }}
        >
          <m.div
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-rajlo-red px-5 py-5 text-white">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                  <Icon name="map-pin" className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                    New
                  </p>
                  <h2
                    id="add-place-title"
                    className="text-xl font-extrabold leading-tight"
                  >
                    Save a place
                  </h2>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              {/* Kind picker */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                  Type
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["home", "work", "office", "school", "gym", "other"] as const).map(
                    (k) => {
                      const disabled =
                        existingKinds.has(k) && k !== "other" && kind !== k;
                      const meta = KIND_META[k];
                      const active = kind === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setKind(k);
                            setLabel(meta.defaultLabel);
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                            active
                              ? "bg-rajlo-red text-white"
                              : disabled
                                ? "cursor-not-allowed bg-surface-soft text-muted opacity-50"
                                : "border border-line bg-surface text-foreground hover:border-rajlo-red/40"
                          }`}
                        >
                          <Icon name={meta.icon} className="h-3.5 w-3.5" />
                          {meta.defaultLabel}
                          {disabled && (
                            <span className="text-[10px] font-medium">
                              · saved
                            </span>
                          )}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Label */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted">
                  Name it
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value.slice(0, 32))}
                  placeholder="e.g. Mum's house, Half Way Tree office"
                  className="mt-1 w-full rounded-xl border border-line bg-surface-soft px-3 py-2.5 text-sm outline-none focus:border-rajlo-red"
                  maxLength={32}
                />
              </div>

              {/* Place picker */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted">
                  Address
                </label>
                <div className="mt-1">
                  <PlacesAutocomplete
                    value={place}
                    onSelect={(p) => setPlace(p)}
                    placeholder="Search an address in Jamaica"
                  />
                </div>
                {place && (
                  <p className="mt-1.5 text-[11px] text-muted">
                    {place.address}
                    {place.parish ? ` · ${place.parish}` : ""}
                  </p>
                )}
              </div>

              {error && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                  {error}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-line bg-surface-soft px-5 py-4 sm:flex-row-reverse">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Icon name="check-circle" className="h-4 w-4" />
                )}
                {saving ? "Saving…" : "Save place"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-full px-6 py-3 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-60 sm:flex-none"
              >
                Cancel
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
