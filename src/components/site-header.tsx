"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Fare estimator", href: "/fare-estimator" },
  { label: "Drive with us", href: "/driver-join" },
  { label: "Safety", href: "/legal/safety" },
];

/**
 * Shared sticky header for all public pages (landing, how-it-works,
 * fare-estimator, driver-join, legal/*). Highlights the current route as
 * active using `usePathname()`.
 */
export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md supports-backdrop-filter:bg-surface/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 md:gap-4">
        <Logo size="sm" tagline />

        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {NAV_LINKS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "text-sm font-semibold text-foreground"
                    : "text-sm font-medium text-muted hover:text-foreground"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/auth/rider/login"
            className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/auth/rider/signup"
            className="rounded-full bg-rajlo-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Book a ride
          </Link>
        </div>
      </div>
    </header>
  );
}
