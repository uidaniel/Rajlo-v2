"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";

/**
 * Shared incident reporting form for riders and drivers. Submits to
 * POST /api/incidents. Critical categories (accident, assault, …) are
 * auto-escalated server-side, so the form just collects the facts.
 *
 * The "which trip" field is a dropdown of the caller's recent trips
 * (loaded from /api/incidents/my-trips) so the reporter picks rather
 * than hunts for a trip id.
 */

type Trip = { id: string; label: string };

const INCIDENT_TYPES: { value: string; label: string }[] = [
  { value: "accident", label: "Vehicle accident" },
  { value: "unsafe_driving", label: "Unsafe driving" },
  { value: "harassment", label: "Harassment" },
  { value: "assault", label: "Assault" },
  { value: "threats", label: "Threats or intimidation" },
  { value: "criminal_activity", label: "Criminal activity" },
  { value: "lost_property", label: "Lost property" },
  { value: "incorrect_charge", label: "Incorrect charge" },
  { value: "driver_misconduct", label: "Driver misconduct" },
  { value: "rider_misconduct", label: "Rider misconduct" },
  { value: "vehicle_damage", label: "Vehicle damage" },
  { value: "vehicle_cleanliness", label: "Vehicle cleanliness" },
  { value: "payment_dispute", label: "Payment dispute" },
  { value: "technical_issue", label: "App / technical issue" },
  { value: "other", label: "Something else" },
];

export function IncidentReportForm() {
  const router = useRouter();
  const [incidentType, setIncidentType] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tripId, setTripId] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Load the reporter's recent trips for the "which trip" dropdown.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/incidents/my-trips", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { trips?: Trip[] } | null) => {
        if (!cancelled && json?.trips) setTrips(json.trips);
      })
      .catch(() => {
        /* dropdown just stays empty — trip is optional anyway */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit =
    incidentType && title.trim() && description.trim().length >= 10;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentType,
          severity,
          title: title.trim(),
          description: description.trim(),
          tripId: tripId.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't file the report.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-600 text-white">
          <Icon name="check-circle" className="h-6 w-6" />
        </div>
        <h2 className="mt-3 text-lg font-extrabold text-emerald-900">
          Report filed
        </h2>
        <p className="mt-1 text-sm text-emerald-800">
          Our safety team has your report and will review it. You can
          track its status anytime.
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-5 rounded-full bg-rajlo-red px-6 py-2.5 text-sm font-bold text-white"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-primary-soft px-4 py-3 text-xs leading-relaxed text-rajlo-black">
        <strong>In immediate danger?</strong> Call <strong>119</strong>{" "}
        (Police) or <strong>110</strong> (Fire &amp; Ambulance) first — then
        file this report.
      </div>

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          What happened?
        </span>
        <select
          value={incidentType}
          onChange={(e) => setIncidentType(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm focus:border-rajlo-red focus:outline-none"
        >
          <option value="">Select a category…</option>
          {INCIDENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          How serious is it?
        </span>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm focus:border-rajlo-red focus:outline-none"
        >
          <option value="low">Low — minor issue</option>
          <option value="medium">Medium — needs attention</option>
          <option value="high">High — serious</option>
          <option value="critical">Critical — urgent / dangerous</option>
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          Title
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="A short summary"
          className="mt-1.5 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm focus:border-rajlo-red focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          Describe what happened
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          placeholder="Include as much detail as you can — what happened, when, and who was involved."
          className="mt-1.5 w-full rounded-xl border border-line bg-background px-3.5 py-3 text-sm leading-relaxed focus:border-rajlo-red focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          Which trip? <span className="font-normal lowercase">(optional)</span>
        </span>
        {trips.length > 0 ? (
          <select
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm focus:border-rajlo-red focus:outline-none"
          >
            <option value="">Not about a specific trip</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-1.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-muted">
            No past trips to link.
          </p>
        )}
      </label>

      {error && (
        <p className="text-xs font-semibold text-rajlo-red">{error}</p>
      )}

      <button
        type="button"
        disabled={!canSubmit || busy}
        onClick={submit}
        className="inline-flex w-full items-center justify-center rounded-full bg-rajlo-red px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {busy ? "Filing report…" : "File report"}
      </button>
    </div>
  );
}
