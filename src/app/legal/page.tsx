import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { getAllEffectiveLegalDocuments } from "@/lib/legal-store";

/**
 * RAJLO legal centre — index of every policy. Linked from the footer,
 * every consent screen, the signup flows, and in-app settings.
 *
 * Lists the EFFECTIVE documents (admin-published edits if any,
 * otherwise the baseline), so a republished title/version shows here
 * immediately — hence `force-dynamic`.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Legal Centre — RAJLO",
  description:
    "Every RAJLO policy in one place — Terms of Service, Privacy Policy, payment, safety, conduct, and driver agreements.",
  alternates: { canonical: "/legal" },
};

const AUDIENCE_LABEL: Record<string, string> = {
  everyone: "All users",
  rider: "Riders",
  driver: "Drivers",
};

export default async function LegalIndexPage() {
  const docs = await getAllEffectiveLegalDocuments();

  const groups = [
    {
      label: "Applies to everyone",
      docs: docs.filter((d) => d.audience === "everyone"),
    },
    { label: "For riders", docs: docs.filter((d) => d.audience === "rider") },
    { label: "For drivers", docs: docs.filter((d) => d.audience === "driver") },
  ];

  return (
    <MarketingShell>
      <section className="bg-rajlo-black py-14 text-white md:py-20">
        <div className="mx-auto max-w-3xl px-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-rajlo-red">
            RAJLO Legal
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
            Legal Centre
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70">
            Every policy that governs your use of RAJLO. When you sign up
            and when a policy is updated, RAJLO records exactly which
            version you accepted, with a timestamp — for your protection
            and ours.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 py-12">
        {groups.map((group) =>
          group.docs.length === 0 ? null : (
            <div key={group.label} className="mb-10">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted">
                {group.label}
              </h2>
              <ul className="mt-4 space-y-3">
                {group.docs.map((doc) => (
                  <li key={doc.key}>
                    <Link
                      href={`/legal/${doc.key}`}
                      className="block rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-rajlo-red"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-extrabold tracking-tight">
                          {doc.title}
                        </h3>
                        <span className="shrink-0 rounded-full bg-rajlo-red/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
                          {AUDIENCE_LABEL[doc.audience]}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">
                        {doc.summary}
                      </p>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
                        Version {doc.version}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </div>
    </MarketingShell>
  );
}
