import { NextResponse } from "next/server";

/**
 * GET /api/weather?lat=...&lng=...
 *
 * Lightweight wrapper around the Open-Meteo current-weather endpoint.
 * Open-Meteo is free, no API key required, no rate limit for our
 * volume — perfect for surfacing a friendly "today's weather" strip
 * on the rider booking page without standing up a paid OpenWeatherMap
 * account.
 *
 * Returns a flat, UI-ready shape:
 *   {
 *     tempC, tempF,
 *     condition: "clear" | "cloudy" | "rain" | "thunderstorm" | "fog" | "snow",
 *     isDay,
 *     description, witty,
 *     fetchedAt
 *   }
 *
 * Cached for 10 minutes per (lat,lng) bucket via Next's fetch cache so
 * a dozen riders refreshing the booking page don't all hit the upstream.
 */

type Condition =
  | "clear"
  | "cloudy"
  | "rain"
  | "thunderstorm"
  | "fog"
  | "snow";

type WittyEntry = {
  description: string;
  witty: string;
};

// Open-Meteo follows the WMO weather-code table:
// https://open-meteo.com/en/docs#api_form
// We collapse the ~30 raw codes into 6 user-facing conditions so the
// UI can pick an icon + the witty quip below.
function mapWmoCode(code: number, isDay: boolean): Condition {
  if (code === 0) return "clear";
  if (code === 1 || code === 2 || code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 71 || code === 73 || code === 75 || code === 77 || (code >= 85 && code <= 86))
    return "snow";
  if (code >= 95 && code <= 99) return "thunderstorm";
  // Fall-through: anything we don't recognise reads as "cloudy" so we
  // never surface raw codes to the user.
  return isDay ? "cloudy" : "cloudy";
}

// Witty messages — tone matches the rest of Rajlo's product copy:
// confident, warm, Jamaica-aware where relevant. Pick one at random
// per bucket so the same rider doesn't see the exact same line every
// load.
const WITTY: Record<Condition, WittyEntry[]> = {
  clear: [
    { description: "Clear skies", witty: "Beach weather. Roll the windows down." },
    { description: "Sunny", witty: "Good driving day. Don't forget your shades." },
    { description: "Bright + clear", witty: "Picture-perfect — make the ride count." },
  ],
  cloudy: [
    { description: "Cloudy", witty: "Cool and easy — perfect rideshare weather." },
    { description: "Overcast", witty: "Soft light, no glare. Sit back and enjoy." },
    { description: "Partly cloudy", witty: "Could go either way — we'd carry an umbrella anyway." },
  ],
  rain: [
    { description: "Rain", witty: "Rainy day — make sure you grab your umbrella." },
    { description: "Showers", witty: "Wet roads ahead. Glad you're not walking." },
    { description: "Drizzle", witty: "Light rain — the kind that ruins shoes." },
  ],
  thunderstorm: [
    { description: "Thunderstorm", witty: "Storm rolling in. Inside the car is the right place." },
    { description: "Heavy rain + lightning", witty: "Definitely not walking weather. We got you." },
  ],
  fog: [
    { description: "Foggy", witty: "Low visibility — verified drivers, careful roads." },
    { description: "Mist", witty: "Quiet morning — the kind that smells like coffee." },
  ],
  snow: [
    // Jamaica doesn't see snow but Open-Meteo's global codes do — leave
    // these here for edge cases / international diaspora using the app
    // from abroad.
    { description: "Snow", witty: "Unusual for Jamaica — wherever you are, bundle up." },
  ],
};

function pickWitty(
  condition: Condition,
  seed: number,
): WittyEntry {
  const options = WITTY[condition];
  return options[seed % options.length];
}

type UpstreamResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
    is_day?: 0 | 1;
    apparent_temperature?: number;
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "lat and lng query params required" },
      { status: 400 },
    );
  }

  // Round to 1 decimal (~11 km grid) for cache-key stability — Open-Meteo
  // resolution doesn't change within that bucket and we get 100% cache
  // hits for everyone in the same parish.
  const latKey = lat.toFixed(1);
  const lngKey = lng.toFixed(1);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latKey}` +
    `&longitude=${lngKey}` +
    `&current=temperature_2m,apparent_temperature,weather_code,is_day` +
    `&temperature_unit=celsius&timezone=auto`;

  try {
    const res = await fetch(url, {
      // Cache for 10 minutes per bucketed coord. Open-Meteo updates its
      // current-weather data every ~15 min so this is well under the
      // upstream refresh interval — riders see fresh-enough data and we
      // don't hammer their service.
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Weather upstream returned ${res.status}` },
        { status: 502 },
      );
    }
    const json = (await res.json()) as UpstreamResponse;
    const cur = json.current;
    if (!cur || typeof cur.temperature_2m !== "number") {
      return NextResponse.json(
        { error: "Weather response missing current data" },
        { status: 502 },
      );
    }
    const tempC = cur.temperature_2m;
    const tempF = (tempC * 9) / 5 + 32;
    const isDay = cur.is_day === 1;
    const condition = mapWmoCode(cur.weather_code ?? 0, isDay);
    // Seed the witty picker with the rounded hour + coord bucket so the
    // same rider sees the same line if they refresh inside a minute,
    // but gets a different one an hour later — keeps the page feeling
    // alive without being random-on-every-keypress.
    const seed =
      Math.floor(Date.now() / 3_600_000) +
      Math.round(lat * 7) +
      Math.round(lng * 13);
    const { description, witty } = pickWitty(condition, seed);

    return NextResponse.json({
      tempC: Math.round(tempC),
      tempF: Math.round(tempF),
      apparentC:
        typeof cur.apparent_temperature === "number"
          ? Math.round(cur.apparent_temperature)
          : null,
      condition,
      isDay,
      description,
      witty,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't reach weather service" },
      { status: 502 },
    );
  }
}
