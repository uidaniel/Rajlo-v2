import { redirect } from "next/navigation";

/**
 * /rider/rate?id=<rideId>
 *
 * Compatibility redirect. Older push notifications + trip-completed
 * emails landed riders here; the actual rating UI lives on the trip
 * detail page (the rider needs to see what trip they're rating
 * before they pick stars). Push the rider through to that view with
 * `?rate=1` so the dialog opens automatically.
 *
 * If the URL has no `id` we send the rider to their history list
 * instead of 404'ing — that's the closest "where to from here?"
 * landing for someone who taps a stale notification.
 */
export default async function RiderRateRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const idRaw = sp.id;
  const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  if (!id) redirect("/rider/history");
  redirect(`/rider/history/${id}?rate=1`);
}
