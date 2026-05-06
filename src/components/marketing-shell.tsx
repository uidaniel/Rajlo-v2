import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

/**
 * Header + footer wrapper for public marketing pages
 * (how-it-works, fare-estimator, driver-join, legal/*).
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
