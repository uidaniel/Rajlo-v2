import Link from "next/link";
import { Icon } from "@/components/icons";
import { getAllEffectiveLegalDocuments } from "@/lib/legal-store";

/**
 * /admin/legal — policy management console.
 *
 * Lists every RAJLO policy with its live version and where the content
 * currently comes from (an admin edit, or the committed baseline).
 * Editing a policy opens the OTP-gated editor at /admin/legal/[key].
 */

export const dynamic = "force-dynamic";

const AUDIENCE_LABEL: Record<string, string> = {
  everyone: "All users",
  rider: "Riders",
  driver: "Drivers",
};

export default async function AdminLegalPage() {
  const docs = await getAllEffectiveLegalDocuments();

  return (
    <div className="mx-auto max-w-3xl px-2 py-2 md:px-3 md:py-8">
      <div className="mb-6">
        <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
          Legal
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">
          Policy management
        </h1>
        <p className="mt-2 text-sm text-muted">
          Edit any RAJLO policy here. Publishing a change requires a
          verification code sent to your admin email — no code deploy.
          Bumping a policy&apos;s version puts every affected user behind
          the consent gate until they re-accept.
        </p>
      </div>

      <ul className="space-y-3">
        {docs.map((doc) => (
          <li key={doc.key}>
            <Link
              href={`/admin/legal/${doc.key}`}
              className="block rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-rajlo-red"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-extrabold tracking-tight">
                  {doc.title}
                </h2>
                <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-rajlo-red">
                  Edit
                  <Icon name="arrow-right" className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{doc.summary}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                <span className="rounded-full bg-rajlo-red/10 px-2.5 py-0.5 uppercase tracking-wider text-rajlo-red">
                  {AUDIENCE_LABEL[doc.audience]}
                </span>
                <span className="rounded-full bg-surface-soft px-2.5 py-0.5 text-muted">
                  Version {doc.version}
                </span>
                <span className="rounded-full bg-surface-soft px-2.5 py-0.5 text-muted">
                  {doc.source === "db" ? "Admin-published" : "Baseline"}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
