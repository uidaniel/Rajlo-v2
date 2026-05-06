import { MarketingShell } from "./marketing-shell";

/**
 * Lightweight wrapper for the three legal pages (terms / privacy / safety).
 * Provides a uniform header treatment and prose container so each page only
 * has to supply its body content.
 */
export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <MarketingShell>
      <section className="bg-rajlo-black py-16 text-white">
        <div className="mx-auto max-w-3xl px-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-rajlo-red">
            Legal
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-white/60">Last updated {lastUpdated}</p>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-4 py-16 prose-rajlo">
        {children}
      </article>
    </MarketingShell>
  );
}
