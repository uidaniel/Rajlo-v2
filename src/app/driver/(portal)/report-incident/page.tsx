import { IncidentReportForm } from "@/components/incident-report-form";

/**
 * /driver/report-incident — drivers file a safety incident or
 * complaint (rider misconduct, vehicle damage, threats, …). The shared
 * form posts to /api/incidents.
 */
export default function DriverReportIncidentPage() {
  return (
    <div className="mx-auto max-w-xl px-2 py-2 md:px-3 md:py-8">
      <div className="mb-6">
        <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
          Safety
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">
          Report an incident
        </h1>
        <p className="mt-2 text-sm text-muted">
          Report rider misconduct, vehicle damage, threats, or any
          safety concern. Every report is reviewed and kept on record.
        </p>
      </div>
      <IncidentReportForm />
    </div>
  );
}
