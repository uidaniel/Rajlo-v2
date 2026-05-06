import Link from "next/link";
import { Logo } from "./logo";

/**
 * Shared footer for all public pages (landing, how-it-works, fare-estimator,
 * driver-join, legal/*). Single source of truth so column links, copyright,
 * and styling stay consistent everywhere.
 */
export function SiteFooter() {
  const cols: { title: string; links: [string, string][] }[] = [
    {
      title: "Product",
      links: [
        ["How it works", "/how-it-works"],
        ["Fare estimator", "/fare-estimator"],
        ["Drive with us", "/driver-join"],
      ],
    },
    {
      title: "Support",
      links: [
        ["Help & FAQs", "/help"],
        ["Safety", "/legal/safety"],
        ["Contact", "/contact"],
      ],
    },
    {
      title: "Legal",
      links: [
        ["Terms", "/legal/terms"],
        ["Privacy", "/legal/privacy"],
        ["Safety policy", "/legal/safety"],
      ],
    },
  ];

  return (
    <footer className="border-t border-white/5 bg-rajlo-black text-white/80">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo size="md" variant="white" tagline href={null} />
            <p className="mt-4 max-w-xs text-sm text-white/60">
              Connecting people and places through reliable, efficient, and
              eco-friendly rides across Jamaica.
            </p>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <p className="font-secondary mb-3 text-xs font-bold uppercase tracking-wider text-white">
                {col.title}
              </p>
              <ul className="space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-white/60 hover:text-white"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/[0.06] pt-6 text-sm text-white/50 md:flex-row md:items-center">
          <p>&copy; {new Date().getFullYear()} Rajlo. All rights reserved.</p>
          <p>Kingston, Jamaica</p>
        </div>
      </div>
    </footer>
  );
}
