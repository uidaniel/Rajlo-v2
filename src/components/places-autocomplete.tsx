"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";
import { loadGoogleMaps } from "@/lib/google-maps";
import { JAMAICA_BOUNDS, detectParish, type Place } from "@/lib/jamaica";

/**
 * `structuredFormat` is part of the Places API (New) PlacePrediction
 * payload at runtime, but `@types/google.maps` doesn't declare it as of
 * the version pinned here. We augment locally so the call sites can stay
 * tidy and typed.
 */
type StructuredFormatLike = {
  mainText?: { toString(): string };
  secondaryText?: { toString(): string };
};
type PredictionWithStructured = google.maps.places.PlacePrediction & {
  structuredFormat?: StructuredFormatLike;
};

/**
 * Google Places autocomplete input, biased to Jamaica.
 *
 * Uses the **new Places API** (`AutocompleteSuggestion` + `Place.fetchFields`)
 * — works with "Places API (New)" enabled in Google Cloud Console. The
 * legacy `AutocompleteService` is deprecated and requires the classic
 * "Places API" instead.
 *
 * - Type-ahead with debounced predictions (180ms)
 * - Picks up POIs (restaurants, landmarks, businesses) AND addresses
 * - Returns a fully-resolved Place (lat/lng + parish) via `onSelect`
 * - Uses session tokens so a session of "type → pick" counts as one
 *   billable autocomplete on Google's pricing
 */
export function PlacesAutocomplete({
  label,
  placeholder = "Search a place, address, or landmark…",
  value,
  onSelect,
  onClear,
  icon = "map-pin",
  required,
  hint,
  autoFocus,
}: {
  label?: string;
  placeholder?: string;
  /** Currently-selected place (parent-owned). */
  value: Place | null;
  /** Called when the user picks a prediction. */
  onSelect: (place: Place) => void;
  /** Called when the user clears the field. */
  onClear?: () => void;
  icon?: IconName;
  required?: boolean;
  hint?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState<string>(value?.name ?? "");
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(
    null,
  );
  const placesLibRef = useRef<google.maps.PlacesLibrary | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  // Load Google Maps + the Places library once.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled) return;
        // After loadGoogleMaps resolves, window.google.maps.places is
        // populated globally. Cache the namespace + a fresh session token.
        placesLibRef.current = window.google.maps
          .places as unknown as google.maps.PlacesLibrary;
        sessionTokenRef.current =
          new window.google.maps.places.AutocompleteSessionToken();
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync the visible query when the parent's value flips externally.
  useEffect(() => {
    if (!value) {
      setQuery("");
    } else if (value.name !== query) {
      setQuery(value.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Click-outside closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const fetchSuggestions = async (q: string) => {
    const places = placesLibRef.current;
    if (!places) return;
    if (!q.trim() || q.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const seq = ++requestSeqRef.current;
    setLoading(true);
    try {
      const { suggestions: results } =
        await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
          {
            input: q,
            sessionToken: sessionTokenRef.current ?? undefined,
            includedRegionCodes: ["jm"],
            locationBias: {
              north: JAMAICA_BOUNDS.north,
              south: JAMAICA_BOUNDS.south,
              east: JAMAICA_BOUNDS.east,
              west: JAMAICA_BOUNDS.west,
            },
          },
        );
      // Drop stale responses that returned out of order.
      if (seq !== requestSeqRef.current) return;
      const filtered = results.filter((s) => s.placePrediction);
      setSuggestions(filtered);
      setOpen(true);
      setError(null);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setSuggestions([]);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  };

  const handleQueryChange = (next: string) => {
    setQuery(next);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(next), 180);
  };

  const handlePick = async (
    suggestion: google.maps.places.AutocompleteSuggestion,
  ) => {
    if (!suggestion.placePrediction) return;
    setOpen(false);
    setLoading(true);
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: [
          "id",
          "displayName",
          "formattedAddress",
          "location",
          "addressComponents",
        ],
      });
      // Refresh the session token so the next search starts a fresh one.
      sessionTokenRef.current =
        new window.google.maps.places.AutocompleteSessionToken();

      const components = (place.addressComponents ?? []).map(
        (c): google.maps.GeocoderAddressComponent => ({
          long_name: c.longText ?? "",
          short_name: c.shortText ?? "",
          types: c.types ?? [],
        }),
      );

      const result: Place = {
        placeId: place.id ?? "",
        name:
          place.displayName ??
          suggestion.placePrediction.text?.toString() ??
          "Selected place",
        address: place.formattedAddress ?? "",
        lat: place.location?.lat() ?? 0,
        lng: place.location?.lng() ?? 0,
        parish: detectParish(components),
      };
      setQuery(result.name);
      onSelect(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load that place");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    onClear?.();
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handlePick(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      {label && (
        <label className="mb-1.5 block text-sm font-semibold">
          {label}
          {required && <span className="ml-0.5 text-rajlo-red">*</span>}
        </label>
      )}
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}

      <div
        className={`relative flex items-center rounded-xl border bg-surface transition-all ${
          open
            ? "border-rajlo-red ring-2 ring-rajlo-red/15"
            : "border-line hover:border-rajlo-red/30"
        }`}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center text-muted">
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={handleKey}
          className="min-w-0 flex-1 bg-transparent py-3 pr-2 text-sm outline-none placeholder:text-muted/70"
        />
        {loading && (
          <span className="mr-2 grid h-7 w-7 place-items-center text-rajlo-red">
            <span className="h-4 w-4 animate-spin rounded-full border-[2px] border-current border-t-transparent" />
          </span>
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear"
            className="mr-2 grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-soft hover:text-foreground"
          >
            <Icon name="x" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-xs font-medium text-rajlo-red">{error}</p>
      )}

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl"
        >
          {suggestions.map((s, i) => {
            const pp = s.placePrediction as PredictionWithStructured | null;
            if (!pp) return null;
            const { main, sub } = splitPredictionText(pp);
            const isActive = i === activeIndex;
            const key = pp.placeId ?? `${main}-${i}`;
            return (
              <li key={key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => {
                    // mousedown so click fires before input blur closes us.
                    e.preventDefault();
                    handlePick(s);
                  }}
                  className={`group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                    isActive ? "bg-primary-soft" : "hover:bg-surface-soft"
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      isActive
                        ? "bg-rajlo-red text-white"
                        : "bg-primary-soft text-rajlo-red group-hover:bg-rajlo-red/15"
                    }`}
                  >
                    <Icon name="map-pin" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-foreground">
                      {main}
                    </span>
                    {sub && (
                      // Don't truncate — the full street address is the
                      // whole point of this row. line-clamp-2 lets it
                      // wrap to a second line when needed (e.g. long
                      // addresses with plaza name + street + city +
                      // country) without ever bleeding into the next
                      // suggestion.
                      <span className="mt-0.5 block text-xs leading-snug text-muted line-clamp-2">
                        {sub}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Pulls a clean { main, sub } pair out of an autocomplete prediction.
 *
 * Google's new Places API mostly returns `structuredFormat.mainText`
 * (place name) + `structuredFormat.secondaryText` (street + city) —
 * but for some predictions (notably newer business POIs and address-
 * only suggestions) `structuredFormat` is missing or partially blank.
 * In those cases the only field populated is `text`, which is the
 * full one-liner like "Klean Skin, Constant Spring Road, Kingston
 * Jamaica". If we just dumped that into the row it would render as a
 * single truncated line — exactly the bug riders were seeing.
 *
 * Strategy: prefer `structuredFormat`, but if either side is missing,
 * fall back to splitting the full text on the first comma. The first
 * comma in a place prediction reliably separates the place name from
 * the address ("BusinessName, 17 Street Rd, City, Country").
 */
function splitPredictionText(pp: PredictionWithStructured): {
  main: string;
  sub: string;
} {
  const sf = pp.structuredFormat;
  const fullText = pp.text?.toString() ?? "";
  const sfMain = sf?.mainText?.toString() ?? "";
  const sfSub = sf?.secondaryText?.toString() ?? "";

  let main = sfMain;
  let sub = sfSub;

  if (!main || !sub) {
    const firstComma = fullText.indexOf(",");
    if (firstComma > 0) {
      if (!main) main = fullText.slice(0, firstComma).trim();
      if (!sub) sub = fullText.slice(firstComma + 1).trim();
    } else if (!main) {
      // Single-token prediction — no comma to split on.
      main = fullText.trim();
    }
  }

  return { main, sub };
}
