import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing-shell";
import { LEGAL_DOCUMENTS } from "@/lib/legal-documents";
import { getEffectiveLegalDocument } from "@/lib/legal-store";
import { parseLegalText, type LegalBlock } from "@/lib/legal-content";

/**
 * Canonical viewer for every RAJLO policy — `/legal/<key>`.
 *
 * Content is the EFFECTIVE document: an admin-published edit from the
 * `legal_documents` table if one exists, otherwise the committed
 * `policies/*.txt` baseline. Because an admin can republish a policy
 * at any time, the route renders dynamically (`force-dynamic`) so a
 * published edit is live immediately — no rebuild.
 *
 * Still fully server-rendered, so Googlebot receives complete HTML.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getEffectiveLegalDocument(slug);
  if (!doc) return {};
  return {
    title: `${doc.title} — RAJLO Legal`,
    description: doc.summary,
    alternates: { canonical: `/legal/${doc.key}` },
  };
}

/** Render one parsed block. */
function Block({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case "section":
      return (
        <h2 className="mt-10 text-xl font-extrabold tracking-tight text-foreground md:text-2xl">
          {block.text}
        </h2>
      );
    case "subsection":
      return (
        <h3 className="mt-6 text-base font-bold tracking-tight text-foreground">
          {block.text}
        </h3>
      );
    case "lead":
      return (
        <p className="mt-4 text-sm leading-relaxed text-muted">{block.text}</p>
      );
    case "para":
      return (
        <p className="mt-4 text-sm leading-relaxed text-muted">{block.text}</p>
      );
    case "list":
      return (
        <ul className="mt-3 space-y-1.5">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="flex gap-2.5 text-sm leading-relaxed text-muted"
            >
              <span
                aria-hidden
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rajlo-red/60"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
  }
}

export default async function LegalDocumentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = await getEffectiveLegalDocument(slug);
  if (!doc) notFound();

  const { intro, blocks } = parseLegalText(doc.body, doc.title);
  const effective = new Date(doc.effectiveDate).toLocaleDateString("en-JM", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const otherDocs = LEGAL_DOCUMENTS.filter((d) => d.key !== doc.key);

  return (
    <MarketingShell>
      {/* Header */}
      <section className="bg-rajlo-black py-14 text-white md:py-20">
        <div className="mx-auto max-w-3xl px-5">
          <Link
            href="/legal"
            className="text-xs font-bold uppercase tracking-[0.18em] text-rajlo-red hover:underline"
          >
            ← RAJLO Legal
          </Link>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
            {doc.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-white/10 px-3 py-1 font-bold text-white/90">
              Version {doc.version}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 font-bold text-white/90">
              Effective {effective}
            </span>
          </div>
        </div>
      </section>

      {/* Body */}
      <article className="mx-auto max-w-3xl px-5 py-12">
        {intro.map((para, i) => (
          <p
            key={i}
            className={`text-sm leading-relaxed text-muted ${i > 0 ? "mt-3" : ""}`}
          >
            {para}
          </p>
        ))}
        {blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}

        {/* Footer note */}
        <p className="mt-12 border-t border-line pt-6 text-xs leading-relaxed text-muted">
          This document forms part of your agreement with RAJLO. By
          continuing to use the RAJLO platform you accept this policy as
          currently published. RAJLO records the version of each policy
          you accept, with a timestamp, for both parties&apos; protection.
        </p>
      </article>

      {/* Other policies */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted">
            All RAJLO policies
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {otherDocs.map((d) => (
              <li key={d.key}>
                <Link
                  href={`/legal/${d.key}`}
                  className="block rounded-xl border border-line bg-background px-4 py-3 text-sm font-semibold transition-colors hover:border-rajlo-red hover:text-rajlo-red"
                >
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </MarketingShell>
  );
}
