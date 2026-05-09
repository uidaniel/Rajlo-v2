import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";

/**
 * Catch-all for any driver portal route that hasn't been built into a
 * dedicated page yet. The only one that legitimately lands here today
 * is `/driver/payouts` — payments isn't wired up yet (deliberately,
 * per product). Anything else is a 404.
 *
 * The dummy-data placeholders that used to live here (Documents,
 * Ride requests, Seats, Ratings, Support) all moved to real pages
 * (Verification absorbs Documents) or got removed from the nav.
 */

const COMING_SOON: Record<
  string,
  {
    title: string;
    description: string;
    bullets: string[];
    fallback: { label: string; href: string };
  }
> = {
  payouts: {
    title: "Payouts",
    description:
      "Direct settlement to your bank or mobile money account. Coming soon — once you start earning, your money is tracked in the Earnings dashboard until payouts go live.",
    bullets: [
      "Weekly direct deposits",
      "NCB, Scotiabank, JN, JMMB, NCB Capital — and mobile money",
      "Instant cash-out (small fee) for verified drivers",
    ],
    fallback: { label: "Open earnings dashboard", href: "/driver/earnings" },
  },
};

export default async function DriverComingSoonPage({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  const config = COMING_SOON[screen];
  if (!config) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-2 py-6 md:px-3 md:py-10">
      <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-8 text-white shadow-xl shadow-rajlo-black/30 md:p-10">
        <ArcWatermark
          size={420}
          variant="red"
          className="absolute -right-20 -bottom-32 opacity-[0.18]"
        />
        <div className="relative">
          <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
            Coming soon
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            {config.title}
          </h1>
          <p className="mt-2 max-w-md text-sm text-white/75">
            {config.description}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-muted">
          What this will include
        </p>
        <ul className="mt-3 space-y-2.5">
          {config.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 grid h-1.5 w-1.5 shrink-0 place-items-center rounded-full bg-rajlo-red" />
              <span className="text-foreground">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href={config.fallback.href}
        className="group flex items-center justify-between rounded-2xl border border-dashed border-line bg-surface-soft px-5 py-4 transition-colors hover:border-rajlo-red hover:bg-primary-soft/40"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-rajlo-red shadow-sm">
            <Icon name="arrow-right" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold">{config.fallback.label}</p>
            <p className="mt-0.5 text-xs text-muted">
              While you wait, this is the closest live screen.
            </p>
          </div>
        </div>
        <Icon
          name="chevron-right"
          className="h-5 w-5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-rajlo-red"
        />
      </Link>
    </div>
  );
}
