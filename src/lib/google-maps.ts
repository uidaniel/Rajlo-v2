import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

/**
 * Single Google Maps loader, shared across the whole app. Bootstraps once on
 * first call and returns the cached promise on every subsequent call.
 *
 * Migrated to the functional API (`setOptions` + `importLibrary`) — the old
 * `new Loader({...})` class API was removed in newer versions of
 * @googlemaps/js-api-loader.
 *
 * Libraries we always pull:
 *   - maps     → core Map class
 *   - places   → Autocomplete + place details
 *   - marker   → Modern AdvancedMarker (cleaner than legacy Marker)
 *   - geometry → spherical helpers (bounds, distance, encoding)
 *
 * The `importLibrary` calls have a useful side-effect: they populate
 * `window.google.maps.*` globally, so existing code that reads
 * `google.maps.places.AutocompleteService` etc. keeps working.
 */

let bootstrapped: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google Maps can only load in the browser"),
    );
  }
  if (!bootstrapped) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return Promise.reject(
        new Error(
          "Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — add it to .env.local and Vercel",
        ),
      );
    }
    setOptions({ key: apiKey, v: "weekly" });
    bootstrapped = Promise.all([
      importLibrary("maps"),
      importLibrary("places"),
      importLibrary("marker"),
      importLibrary("geometry"),
      // routes library carries DirectionsService + DirectionsRenderer for
      // road-following polylines on the booking flow.
      importLibrary("routes"),
    ]).then(() => window.google);
  }
  return bootstrapped;
}
