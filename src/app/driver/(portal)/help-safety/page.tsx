"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { ArcWatermark } from "@/components/arc-pattern";
import { FadeUp } from "@/components/anim";

/**
 * Driver help & safety hub.
 *
 * Three rolled into one because the questions a driver has and the
 * tools they need in an incident overlap heavily — keeping them on
 * one screen means safety steps are never more than a tap away during
 * a stressful moment.
 *
 * Sections:
 *   1. Hero with one-tap emergency call (119 / 110 / 911) and a
 *      "report a serious incident" mailto
 *   2. Quick safety toolkit (verify rider, share trip with operations,
 *      cancel safely, deactivate temporarily)
 *   3. Driver FAQ (acceptance rate, expiring docs, payouts, etc.)
 *   4. Contact support (email + tel)
 */

type FAQ = {
  q: string;
  a: string;
  category: "trips" | "compliance" | "earnings" | "account";
};

const FAQS: FAQ[] = [
  {
    category: "trips",
    q: "How does my acceptance rate work?",
    a: "We count rides you accepted vs rides you cancelled in the last 30 days. System-cancelled rides (where no driver picked up before timeout) don't count against you. A rate above 70% keeps you eligible for surge zones; below 50% triggers an automatic check-in from operations.",
  },
  {
    category: "trips",
    q: "Can I cancel a ride after I accept it?",
    a: "Yes — for free, before the trip starts. Repeated cancellations after acceptance lower your acceptance rate. After the trip starts you complete it normally; mid-trip 'cancel' isn't supported in the app — contact operations if there's an emergency.",
  },
  {
    category: "trips",
    q: "What if a rider doesn't show up?",
    a: "Wait at the pickup for 5 minutes from the moment you mark 'Arrived', then chat or call them through the app's masked number. After 8 minutes with no response, you can cancel as 'rider no-show' from the active-trip screen — that doesn't penalise your acceptance rate and a small no-show fee may apply.",
  },
  {
    category: "compliance",
    q: "What happens when a TA document expires?",
    a: "Your account auto-suspends the moment any TA-required document expires (badge, COF, insurance, franchise, registration). Renew at the issuing authority, then upload the new document via TA verification — admin re-reviews within 1–2 business days and reactivates you.",
  },
  {
    category: "compliance",
    q: "I changed my car. What now?",
    a: "Submit a vehicle change from your profile. You'll re-upload registration, COF, and PPV insurance for the new vehicle. Keep accepting rides on your current vehicle until admin approves the change — the moment they do, your active vehicle flips automatically.",
  },
  {
    category: "earnings",
    q: "When will I get paid?",
    a: "Payouts go live in a future release. For now, every completed trip is recorded in Earnings with the JMD value. Once payouts launch, settlements run weekly (Friday cut-off, money lands the next business day).",
  },
  {
    category: "account",
    q: "How do I take a break without losing my account?",
    a: "Just toggle yourself offline from the dashboard. Your account stays active, your compliance docs keep their status, and you can come back anytime. No need to deactivate the whole account.",
  },
  {
    category: "account",
    q: "How do I delete my driver account?",
    a: "Email support@rajlo.com from your registered email. We process deletions within 7 days, removing all PII while retaining anonymised trip records for legal compliance.",
  },
];

const CATEGORY: Record<FAQ["category"], { label: string; icon: IconName }> = {
  trips: { label: "Trips", icon: "navigation" },
  compliance: { label: "Compliance", icon: "shield-check" },
  earnings: { label: "Earnings", icon: "trending-up" },
  account: { label: "Account", icon: "user" },
};

const SAFETY_TOOLS: {
  label: string;
  caption: string;
  icon: IconName;
  href: string;
  external?: boolean;
}[] = [
  {
    label: "Police emergency · 119",
    caption: "Call dispatch directly from your phone.",
    icon: "phone",
    href: "tel:119",
    external: true,
  },
  {
    label: "Report a serious incident",
    caption: "Email Rajlo safety with a description + your driver ID.",
    icon: "alert-triangle",
    href: "mailto:safety@rajlo.com?subject=Driver%20safety%20incident&body=Driver%20ID%3A%20%0A%0AWhat%20happened%3A%20%0A%0AWhen%20%2F%20where%3A%20%0A%0AOther%20parties%3A%20",
    external: true,
  },
  {
    label: "Open active trip",
    caption: "Cancel safely if something feels off (no penalty pre-start).",
    icon: "navigation",
    href: "/driver/active-trip",
  },
  {
    label: "Toggle offline",
    caption: "Pause new ride requests from the dashboard at any time.",
    icon: "x",
    href: "/driver",
  },
];

export default function DriverHelpSafetyPage() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter(
      (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => {
    const out = new Map<FAQ["category"], FAQ[]>();
    for (const f of filtered) {
      const list = out.get(f.category) ?? [];
      list.push(f);
      out.set(f.category, list);
    }
    return out;
  }, [filtered]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-2 md:px-3 md:py-8">
      {/* Hero with emergency CTA */}
      <FadeUp>
        <div className="relative overflow-hidden rounded-3xl bg-rajlo-black p-6 text-white shadow-xl shadow-rajlo-black/30 md:p-8">
          <ArcWatermark
            size={420}
            variant="red"
            className="absolute -right-20 -bottom-32 opacity-[0.18]"
          />
          <div className="relative">
            <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
              Help & safety
            </p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              We&apos;ve got your back
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/80">
              One tap to reach emergency services, one tap to flag an incident.
              Help articles, contact channels, and the rest of your safety
              toolkit live below.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href="tel:119"
                className="inline-flex items-center gap-2 rounded-full bg-rajlo-red px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rajlo-red/30 transition-transform hover:-translate-y-0.5"
              >
                <Icon name="phone" className="h-4 w-4" />
                Call police · 119
              </a>
              <a
                href="mailto:safety@rajlo.com"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white/15"
              >
                <Icon name="alert-triangle" className="h-4 w-4" />
                Report an incident
              </a>
            </div>
          </div>
        </div>
      </FadeUp>

      {/* Safety tools */}
      <FadeUp delay={0.05}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-soft text-rajlo-red">
              <Icon name="shield" className="h-3.5 w-3.5" />
            </span>
            <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
              Safety tools
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SAFETY_TOOLS.map((tool) => {
              const inner = (
                <>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-rajlo-red transition-colors group-hover:bg-rajlo-red group-hover:text-white">
                    <Icon name={tool.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold tracking-tight">
                      {tool.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{tool.caption}</p>
                  </div>
                  <Icon
                    name="chevron-right"
                    className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-rajlo-red"
                  />
                </>
              );
              const className =
                "group flex items-start gap-3 rounded-2xl border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-rajlo-red/30 hover:shadow-md";
              return tool.external ? (
                <a key={tool.label} href={tool.href} className={className}>
                  {inner}
                </a>
              ) : (
                <Link key={tool.label} href={tool.href} className={className}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      </FadeUp>

      {/* FAQ search */}
      <FadeUp delay={0.1}>
        <div className="relative">
          <Icon
            name="search"
            className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search driver FAQ…"
            className="w-full rounded-full border border-line bg-surface py-3.5 pl-11 pr-4 text-sm text-foreground outline-none ring-2 ring-transparent transition-all placeholder:text-muted focus:ring-rajlo-red/40"
          />
        </div>
      </FadeUp>

      {/* FAQ groups */}
      {grouped.size === 0 && (
        <FadeUp delay={0.12}>
          <div className="rounded-3xl border border-line bg-surface p-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-soft text-muted">
              <Icon name="search" className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-base font-extrabold tracking-tight">
              Nothing found for &ldquo;{query}&rdquo;
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Email us if you can&apos;t find the answer below.
            </p>
          </div>
        </FadeUp>
      )}

      {Array.from(grouped.entries()).map(([cat, list], idx) => {
        const meta = CATEGORY[cat];
        return (
          <FadeUp key={cat} delay={0.12 + idx * 0.04}>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="flex items-center gap-2 border-b border-line bg-surface-soft px-5 py-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-rajlo-red text-white">
                  <Icon name={meta.icon} className="h-3.5 w-3.5" />
                </span>
                <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                  {meta.label}
                </p>
                <span className="ml-auto text-[11px] font-semibold text-muted">
                  {list.length} article{list.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul>
                {list.map((f) => {
                  const id = `${cat}-${f.q}`;
                  const open = openId === id;
                  return (
                    <li
                      key={id}
                      className="border-b border-line last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : id)}
                        aria-expanded={open}
                        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-soft"
                      >
                        <span className="text-sm font-bold">{f.q}</span>
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-soft text-muted transition-transform ${
                            open ? "rotate-45" : ""
                          }`}
                        >
                          <Icon name="plus-circle" className="h-3.5 w-3.5" />
                        </span>
                      </button>
                      {open && (
                        <p className="px-5 pb-5 pt-0 text-sm leading-relaxed text-muted">
                          {f.a}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </FadeUp>
        );
      })}

      {/* Contact card */}
      <FadeUp delay={0.3}>
        <div className="overflow-hidden rounded-3xl border border-rajlo-red/30 bg-primary-soft">
          <div className="bg-rajlo-red p-6 text-white md:p-8">
            <p className="font-secondary text-xs font-bold uppercase tracking-wider text-white/85">
              Still need a human?
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">
              Talk to driver support
            </h2>
            <p className="mt-2 max-w-md text-sm text-white/85">
              Real people based in Kingston. Email is fastest for non-urgent
              issues; the phone line is for trip-blocking emergencies.
            </p>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2 md:p-6">
            <a
              href="mailto:driver-support@rajlo.com"
              className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-rajlo-red"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-rajlo-red">
                <Icon name="mail" className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Email
                </p>
                <p className="truncate text-sm font-extrabold">
                  driver-support@rajlo.com
                </p>
              </div>
              <Icon
                name="arrow-right"
                className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-rajlo-red"
              />
            </a>
            <a
              href="tel:+18761234567"
              className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-rajlo-red"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-rajlo-red">
                <Icon name="phone" className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Driver hotline
                </p>
                <p className="truncate text-sm font-extrabold">
                  +1 876 123 4567
                </p>
              </div>
              <Icon
                name="arrow-right"
                className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-rajlo-red"
              />
            </a>
          </div>
        </div>
      </FadeUp>
    </div>
  );
}
