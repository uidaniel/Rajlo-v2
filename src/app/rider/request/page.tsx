"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { FadeUp } from "@/components/anim";
import { PlacesAutocomplete } from "@/components/places-autocomplete";
import { MapView } from "@/components/map-view";
import { loadGoogleMaps } from "@/lib/google-maps";
import { useFleet } from "@/lib/use-fleet";
import {
  detectParish,
  estimateFare,
  formatJMD,
  type Place,
} from "@/lib/jamaica";

/**
 * Rider booking screen. Multi-stop aware: pickup + 0–4 intermediate stops +
 * dropoff. Live map preview, live fare preview.
 *
 * Two completely separate layouts (mobile / desktop) rendered side by side
 * with `md:hidden` / `hidden md:flex`. The breakpoint just swaps which tree
 * is mounted — no layout-property overrides between mobile and desktop.
 *
 * - Mobile: map on top (h-64), sliding-sheet form below, action bar fixed
 *   at the viewport bottom.
 * - Desktop: map card on the left (flex-1 with rounded corners), form card
 *   on the right (w-[420px] with rounded corners). The action bar lives
 *   INSIDE the form card at the bottom — width = column width = 420px,
 *   never covers map content, never spans the full viewport.
 */
export default function RiderRequestPage() {
  const router = useRouter();
  const [pickup, setPickup] = useState<Place | null>(null);
  // Stops is `(Place | null)[]` so an "Add stop" tap can spawn an empty row
  // the user fills via autocomplete. Filtered to non-null when computing
  // the route + fare.
  const [stops, setStops] = useState<(Place | null)[]>([]);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [seats, setSeats] = useState(1);
  const [notes, setNotes] = useState("");
  // Phase 2A.3 — opt-in to carpool. When true, the server tries to
  // pair this ride with another rider going the same way and the fare
  // drops to ~65% of solo. If no match is found, the ride proceeds
  // normally as a solo trip at the regular fare.
  const [allowCarpool, setAllowCarpool] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // While we're checking on mount whether the user already has an active
  // ride (and should be sent to the live-trip view instead of the booking
  // form), hide the form to avoid a flash of "book a ride" UI.
  const [bootstrapping, setBootstrapping] = useState(true);

  // On mount: if the rider already has an in-flight ride (e.g. they
  // refreshed mid-flow, or came back from another tab), skip the booking
  // form and send them straight to the live-trip view. This is what
  // makes the whole booking flow refresh-survivable — no state lives in
  // component memory, the URL determines what you see.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/rider/rides/active");
        if (!res.ok) return;
        const json = (await res.json()) as { ride: { id: string } | null };
        if (!cancelled && json.ride) {
          router.replace("/rider/live-trip");
          return;
        }
      } catch {
        /* offline → just show the booking form */
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const filledStops = useMemo(
    () => stops.filter((s): s is Place => s !== null),
    [stops],
  );

  const allPoints = useMemo(() => {
    const list: Place[] = [];
    if (pickup) list.push(pickup);
    filledStops.forEach((s) => list.push(s));
    if (dropoff) list.push(dropoff);
    return list;
  }, [pickup, filledStops, dropoff]);

  const fare = useMemo(
    () => estimateFare(allPoints, seats),
    [allPoints, seats],
  );

  // Subscribe to the global fleet channel so we can show car icons on the
  // booking-screen map. Disabled while we're bootstrapping (no point
  // opening a websocket if we're about to redirect away).
  const fleetDrivers = useFleet(/* active */ !bootstrapping);

  const canSubmit = Boolean(pickup) && Boolean(dropoff) && !submitting;

  const addStop = () => {
    if (stops.length >= 4) return;
    setStops((s) => [...s, null]);
  };

  const updateStop = (index: number, place: Place) => {
    setStops((prev) => {
      const next = [...prev];
      next[index] = place;
      return next;
    });
  };

  const removeStop = (index: number) => {
    setStops((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!canSubmit || !pickup || !dropoff) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/rider/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: {
            name: pickup.name,
            address: pickup.address,
            lat: pickup.lat,
            lng: pickup.lng,
            parish: pickup.parish,
            placeId: pickup.placeId,
          },
          dropoff: {
            name: dropoff.name,
            address: dropoff.address,
            lat: dropoff.lat,
            lng: dropoff.lng,
            parish: dropoff.parish,
            placeId: dropoff.placeId,
          },
          stops: filledStops.map((s) => ({
            name: s.name,
            address: s.address,
            lat: s.lat,
            lng: s.lng,
            parish: s.parish,
            placeId: s.placeId,
          })),
          seats,
          notes,
          allowCarpool,
          fare: {
            totalKm: fare.totalKm,
            etaMinutes: fare.etaMinutes,
            fareJMD: fare.fareJMD,
          },
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Server returned ${res.status}`);
      }
      // Ride is created — hand off to the live-trip view, which is the
      // single source of truth for any ride state. We don't keep the
      // ride id in component state because that doesn't survive a
      // refresh; the live-trip page reads the active ride from the API.
      router.push("/rider/live-trip");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Couldn't create ride.",
      );
      setSubmitting(false);
    }
  };

  if (bootstrapping) {
    // Hide the form while the active-ride check is in flight. Without
    // this the form briefly flashes before the redirect kicks in.
    return (
      <div className="grid place-items-center px-4 py-16">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted">
          <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-rajlo-red border-t-transparent" />
          Loading…
        </div>
      </div>
    );
  }

  /* ───── shared JSX consts read state from this closure, so no prop
     drilling between the two layouts ───── */

  const breadcrumb = (
    <FadeUp delay={0.05}>
      <div className="pointer-events-none absolute left-4 top-4 right-4 flex items-center gap-2">
        <span className="rounded-full bg-rajlo-red px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-rajlo-red/30">
          Booking
        </span>
        <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-rajlo-black shadow-md backdrop-blur">
          {allPoints.length === 0
            ? "Where are we going?"
            : allPoints.length < 2
              ? "Add a destination"
              : `${stops.length + 2} stops planned`}
        </span>
      </div>
    </FadeUp>
  );

  const formSections = (
    <>
      {submitError && (
        <div className="mb-4 rounded-xl border border-rajlo-red/30 bg-primary-soft px-4 py-3 text-sm font-semibold text-rajlo-red">
          {submitError}
        </div>
      )}
      <FadeUp>
        <div className="mb-2 flex items-center gap-2">
          <span className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
            Where to?
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Plan your trip
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          Add up to 4 stops along the way — pick up groceries, grab a BBQ, swing
          by a friend. We&apos;ll route through every one.
        </p>
      </FadeUp>

      <FadeUp delay={0.1}>
        <div className="mt-6 space-y-3">
          <WaypointSlot
            kind="pickup"
            label="A"
            place={pickup}
            onSelect={setPickup}
            onClear={() => setPickup(null)}
          />

          {stops.map((stop, i) => (
            <WaypointSlot
              key={`stop-${i}`}
              kind="stop"
              label={String.fromCharCode(66 + i)}
              place={stop}
              onSelect={(p) => updateStop(i, p)}
              onRemove={() => removeStop(i)}
            />
          ))}

          {stops.length < 4 && (
            <button
              type="button"
              onClick={addStop}
              className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-line bg-surface-soft px-4 py-3 text-sm font-semibold text-muted transition-all hover:border-rajlo-red hover:bg-primary-soft/50 hover:text-rajlo-red"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-muted group-hover:bg-rajlo-red group-hover:text-white">
                <Icon name="plus-circle" className="h-4 w-4" />
              </span>
              Add a stop along the way
            </button>
          )}

          <WaypointSlot
            kind="dropoff"
            label={String.fromCharCode(66 + stops.length)}
            place={dropoff}
            onSelect={setDropoff}
            onClear={() => setDropoff(null)}
          />
        </div>
      </FadeUp>

      <FadeUp delay={0.15}>
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Seats needed</p>
            <p className="text-xs text-muted">
              {seats} passenger{seats === 1 ? "" : "s"}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((n) => {
              const active = seats === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSeats(n)}
                  className={`group relative overflow-hidden rounded-xl border py-3 text-sm font-bold transition-all ${
                    active
                      ? "border-rajlo-red bg-rajlo-red text-white shadow-md shadow-rajlo-red/30"
                      : "border-line bg-surface text-foreground hover:border-rajlo-red/30 hover:bg-primary-soft/30"
                  }`}
                >
                  <Icon
                    name={n === 1 ? "user" : "users"}
                    className={`mx-auto mb-0.5 h-4 w-4 ${active ? "text-white" : "text-muted group-hover:text-rajlo-red"}`}
                  />
                  <span>{n}</span>
                </button>
              );
            })}
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={0.18}>
        <button
          type="button"
          onClick={() => setAllowCarpool((v) => !v)}
          aria-pressed={allowCarpool}
          className={`mt-6 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
            allowCarpool
              ? "border-rajlo-red bg-primary-soft shadow-md shadow-rajlo-red/15"
              : "border-line bg-surface hover:border-rajlo-red/40 hover:bg-primary-soft/40"
          }`}
        >
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
              allowCarpool
                ? "bg-rajlo-red text-white"
                : "bg-primary-soft text-rajlo-red"
            }`}
          >
            <Icon name="users" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-sm font-extrabold tracking-tight">
                Share this ride · save 35%
              </span>
              {allowCarpool && (
                <span className="rounded-full bg-rajlo-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  On
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              {allowCarpool
                ? `Pay around ${formatJMD(Math.max(400, Math.round((fare.fareJMD * 0.65) / 50) * 50))} if we find someone going your way. Falls back to your normal fare if no one matches.`
                : "We'll try to pair you with another rider going the same direction. If no match, you ride solo at the regular fare."}
            </span>
          </span>
          {/* Toggle thumb — visual indicator only; the whole row is clickable */}
          <span
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              allowCarpool ? "bg-rajlo-red" : "bg-line"
            }`}
            aria-hidden
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-all ${
                allowCarpool ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
      </FadeUp>

      <FadeUp delay={0.2}>
        <div className="mt-6">
          <label className="block">
            <span className="text-sm font-semibold">
              Notes for the driver{" "}
              <span className="ml-1 text-xs font-medium text-muted">
                optional
              </span>
            </span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Wait 5 mins at the BBQ stop · I'll have luggage · etc."
              className="mt-2 w-full rounded-xl border border-line bg-surface-soft px-4 py-3 text-sm outline-none transition-all placeholder:text-muted/70 focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15"
            />
          </label>
        </div>
      </FadeUp>

      {fare.fareJMD > 0 && (
        <FadeUp delay={0.25}>
          <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface-soft">
            <div className="flex items-center justify-between border-b border-line bg-white px-5 py-4">
              <div>
                <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
                  Estimated fare
                </p>
                <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-rajlo-red">
                  {formatJMD(fare.fareJMD)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  ETA
                </p>
                <p className="mt-0.5 text-base font-extrabold">
                  ~{fare.etaMinutes} min
                </p>
              </div>
            </div>
            <ul className="space-y-1.5 px-5 py-4">
              {fare.breakdown.map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted">{row.label}</span>
                  <span className="font-semibold text-foreground">
                    {formatJMD(row.amountJMD)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t border-line/60 bg-white px-5 py-2.5 text-[11px] leading-relaxed text-muted">
              Final fare confirmed when your driver accepts. Pay in cash or via
              the app — your choice on arrival.
            </p>
          </div>
        </FadeUp>
      )}
    </>
  );

  const barContent = (
    <>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
          {fare.fareJMD > 0 ? "Trip total" : "Estimate appears here"}
        </p>
        <p className="text-lg font-extrabold tracking-tight">
          {fare.fareJMD > 0 ? formatJMD(fare.fareJMD) : "—"}
        </p>
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-xl hover:shadow-rajlo-red/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:-translate-y-0 disabled:hover:bg-rajlo-red"
      >
        {submitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-[2px] border-white border-t-transparent" />
            Requesting…
          </>
        ) : (
          <>
            Request ride
            <Icon
              name="arrow-right"
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            />
          </>
        )}
      </button>
    </>
  );

  return (
    <>
      {/* ═════════════ MOBILE LAYOUT ═════════════ */}
      <div className="-mx-4 -my-4 flex min-h-[calc(100vh-3.5rem)] flex-col md:hidden">
        {/* Map on top */}
        <div className="relative">
          <MapView
            pickup={pickup}
            stops={filledStops}
            dropoff={dropoff}
            nearbyDrivers={fleetDrivers}
            className="h-64 w-full"
          />
          {breadcrumb}
        </div>

        {/* Form sheet sliding up under the map */}
        <div className="relative -mt-6 flex-1 rounded-t-3xl border-t border-line bg-surface">
          <div className="mx-auto max-w-2xl px-4 pb-32 pt-6">
            {formSections}
          </div>
        </div>

        {/* Fixed bottom action bar — full width of viewport on mobile only */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
          {barContent}
        </div>
      </div>

      {/* ═════════════ DESKTOP LAYOUT ═════════════ */}
      {/* Negative margins cancel PortalLayout's px-4 + md:py-6 wrapper padding
          so the page occupies the full main column (100vh) edge-to-edge.
          Combined with md:h-screen, the page fits exactly inside main → no
          chance of overflow → main never shows a scrollbar on this page. */}
      <div className="hidden md:-mx-4 md:-my-6 md:flex md:h-screen md:gap-5">
        {/* Map card on the left — 50% of the row */}
        <div className="relative min-w-0 flex-1 basis-0 overflow-hidden rounded-3xl shadow-xl shadow-rajlo-black/10">
          <MapView
            pickup={pickup}
            stops={filledStops}
            dropoff={dropoff}
            nearbyDrivers={fleetDrivers}
            className="h-full w-full"
          />
          {breadcrumb}
        </div>

        {/* Form card on the right — 50% of the row */}
        <div className="flex min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-xl shadow-rajlo-red/[0.04]">
          {/* Scrollable form area.
              `min-h-0` is the canonical fix for a flex child that should
              scroll: without it, flex children default to min-height: auto
              and refuse to shrink below their content's intrinsic height,
              which prevents `overflow-y-auto` from doing anything.
              `overflow-x-hidden` guards against any rogue child trying to
              push the column wider than 50%. */}
          <div
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="px-6 pb-6 pt-7">{formSections}</div>
          </div>

          {/* Inline action bar at bottom of form card.
              Width = form card width = 420px, never spans the viewport,
              never covers map content. */}
          <div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4">
            {barContent}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────── Waypoint slot ─────────── */

function WaypointSlot({
  kind,
  label,
  place,
  onSelect,
  onClear,
  onRemove,
}: {
  kind: "pickup" | "stop" | "dropoff";
  label: string;
  place: Place | null;
  onSelect: (p: Place) => void;
  onClear?: () => void;
  onRemove?: () => void;
}) {
  const tone =
    kind === "pickup"
      ? "bg-emerald-500"
      : kind === "dropoff"
        ? "bg-rajlo-red"
        : "bg-rajlo-black";

  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const useCurrentLocation = async () => {
    setLocating(true);
    setLocateError(null);
    try {
      if (!("geolocation" in navigator)) {
        throw new Error("Your browser doesn't support location.");
      }
      // 1. Ask the browser for the user's coordinates.
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10_000,
            maximumAge: 60_000,
          });
        },
      );
      const { latitude, longitude } = position.coords;

      // 2. Reverse-geocode via Google to get a real address + place_id.
      // Use the awaited return value of loadGoogleMaps rather than
      // `window.google` directly — the loader's return type is fully
      // typed (`typeof google`), whereas `window.google` depends on
      // ambient @types/google.maps being globally augmented, which
      // some editor/TS-server configs don't pick up.
      const g = await loadGoogleMaps();
      const geocoder = new g.maps.Geocoder();
      const { results } = await geocoder.geocode({
        location: { lat: latitude, lng: longitude },
      });
      if (!results.length) throw new Error("Couldn't find your address.");
      const top = results[0];

      onSelect({
        placeId: top.place_id ?? "",
        // Pull the first comma-segment as a friendly short name
        // ("12 Hope Road" rather than the full multi-line address).
        name: top.formatted_address.split(",")[0] || "Current location",
        address: top.formatted_address,
        lat: latitude,
        lng: longitude,
        parish: detectParish(top.address_components),
      });
    } catch (err) {
      // Two possible error shapes here:
      //   1. GeolocationPositionError — `.code` is a *number* (1=denied,
      //      2=unavailable, 3=timeout). `instanceof` is unreliable across
      //      browsers, so we sniff by the numeric code instead.
      //   2. Google Geocoder error — `.code` is a *string* like
      //      "REQUEST_DENIED", "ZERO_RESULTS", "OVER_QUERY_LIMIT".
      let msg: string;
      const codeAndMessage =
        err && typeof err === "object"
          ? (err as { code?: unknown; message?: unknown })
          : {};
      const numericCode =
        typeof codeAndMessage.code === "number" ? codeAndMessage.code : null;
      const stringCode =
        typeof codeAndMessage.code === "string" ? codeAndMessage.code : null;

      if (numericCode === 1) {
        // iOS users: the recovery path is in iOS Settings, not Safari.
        // Detect (lazy require to keep the existing import block tidy)
        // and surface the literal menu route.
        const ua =
          typeof navigator !== "undefined" ? navigator.userAgent : "";
        const onIOS =
          /iPad|iPhone|iPod/.test(ua) ||
          (ua.includes("Macintosh") &&
            "maxTouchPoints" in navigator &&
            (navigator as Navigator & { maxTouchPoints?: number })
              .maxTouchPoints !== undefined &&
            ((navigator as Navigator & { maxTouchPoints?: number })
              .maxTouchPoints ?? 0) > 1);
        msg = onIOS
          ? "Location is blocked. Open Settings → Privacy & Security → Location Services → Safari Websites → While Using the App, then refresh and try again."
          : "Location access is blocked. Click the lock icon next to the URL → Site settings → Location → Allow, then try again.";
      } else if (numericCode === 2) {
        msg = "Couldn't determine your location. Try again.";
      } else if (numericCode === 3) {
        msg = "Location request timed out. Try again.";
      } else if (stringCode === "ZERO_RESULTS") {
        msg = "No address found for your location.";
      } else if (stringCode === "REQUEST_DENIED") {
        msg = "Geocoding API isn't enabled or is misconfigured.";
      } else if (stringCode === "OVER_QUERY_LIMIT") {
        msg = "Hit Google's request limit — try again in a moment.";
      } else if (err instanceof Error) {
        msg = err.message;
      } else if (typeof codeAndMessage.message === "string") {
        msg = codeAndMessage.message;
      } else {
        msg = "Couldn't fetch your location.";
      }
      setLocateError(msg);
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="flex items-stretch gap-2.5">
      <div className="flex flex-col items-center pt-2">
        <span
          className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-extrabold text-white shadow-md ${tone}`}
        >
          {label}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <PlacesAutocomplete
          placeholder={
            kind === "pickup"
              ? "Pickup location"
              : kind === "stop"
                ? "Stop along the way"
                : "Where to?"
          }
          value={place}
          onSelect={onSelect}
          onClear={onClear}
          icon={
            kind === "pickup"
              ? "navigation"
              : kind === "stop"
                ? "map-pin"
                : "flag"
          }
        />

        {/* Use my current location — pickup field only, hidden once a
            place has been picked. */}
        {kind === "pickup" && !place && (
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="group mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-[11px] font-bold text-rajlo-red transition-colors hover:bg-rajlo-red hover:text-white disabled:cursor-wait disabled:opacity-70"
          >
            {locating ? (
              <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
            ) : (
              <Icon name="navigation" className="h-3 w-3" />
            )}
            {locating ? "Finding you…" : "Use my current location"}
          </button>
        )}
        {locateError && (
          <p className="mt-1 ml-1 text-[11px] font-medium text-rajlo-red">
            {locateError}
          </p>
        )}

        {place?.parish && (
          <p className="mt-1 ml-1 truncate text-[11px] text-muted">
            <Icon
              name="map-pin"
              className="mr-1 inline-block h-3 w-3 align-text-bottom text-muted"
            />
            {place.address || place.parish}
          </p>
        )}
      </div>
      {kind === "stop" && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove stop"
          className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-primary-soft hover:text-rajlo-red"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

