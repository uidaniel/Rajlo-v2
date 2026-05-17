import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { ArcWatermark } from "@/components/arc-pattern";

type Category = {
  title: string;
  blurb: string;
  faqs: { q: string; a: string }[];
};

const CATEGORIES: Category[] = [
  {
    title: "For riders",
    blurb: "Booking, fares, seats, and payments.",
    faqs: [
      {
        q: "How do I sign up as a rider?",
        a: "Tap Book a ride, enter your name, email, and Jamaica phone number, and verify the 6-digit code we send by SMS. Takes under a minute.",
      },
      {
        q: "How is my fare calculated?",
        a: "Fares use parish-aware rules: a base fare, distance, multi-seat factor, and a small platform fee. We show the full breakdown before you tap Confirm — no surge surprises.",
      },
      {
        q: "Can I book multiple seats in one trip?",
        a: "Yes. Rajlo supports 1 to 4 seats per booking. Drivers can run shared-ride or private mode depending on their preference.",
      },
      {
        q: "How do I pay?",
        a: "Payments will be handled in-app at the end of every trip — credit/debit card or supported Jamaica wallets. We're rolling out payment methods region-by-region.",
      },
      {
        q: "Can I cancel a ride?",
        a: "Yes — free if the driver hasn't accepted yet. After acceptance, a small cancellation fee may apply depending on driver distance.",
      },
      {
        q: "What if I leave something in the driver's car?",
        a: "Open the trip in your Ride History and tap Report an issue. We'll connect you with your driver via anonymous in-app messaging.",
      },
    ],
  },
  {
    title: "For drivers",
    blurb: "Onboarding, compliance, earnings, payouts.",
    faqs: [
      {
        q: "How do I become a Rajlo driver?",
        a: "Tap Drive with Rajlo, create a driver account, and complete the onboarding wizard. You'll upload all 10 mandatory TA documents, and an admin reviews each — usually within 48 hours. Once approved, you can accept rides immediately.",
      },
      {
        q: "What documents do I need?",
        a: "TA Franchise Certificate, TA Driver Badge, Certificate of Fitness, PPV Comprehensive Insurance, valid PPV-class Driver's Licence, TRN, NIS, Police Record, Red Plate Vehicle Registration, and an identity selfie. Rajlo is red-plate-only — private/white-plate vehicles aren't eligible.",
      },
      {
        q: "How long does verification take?",
        a: "Typically within 48 hours of upload. If anything is missing or unclear, we'll flag it in your dashboard with a Resubmit option so you can fix it without restarting.",
      },
      {
        q: "How are payouts calculated?",
        a: "Each trip shows a transparent breakdown: rider fare, platform fee, and your earnings. Payouts run on a regular schedule to your registered Jamaica bank account.",
      },
      {
        q: "What if my documents are about to expire?",
        a: "We send in-app, email, and SMS reminders 60, 30, and 7 days before expiry. If a document does lapse, your account auto-suspends until you re-upload and we re-approve.",
      },
      {
        q: "Can I be both a rider and a driver?",
        a: "Yes — one Rajlo account, two modes. You can switch between the rider and driver portals from the menu.",
      },
    ],
  },
  {
    title: "Safety & support",
    blurb: "Vetting, in-trip safety, and incident reports.",
    faqs: [
      {
        q: "How are Rajlo drivers vetted?",
        a: "Every driver holds a current TA Franchise Certificate, Police Record, valid Driver's Licence, and PPV insurance. We re-verify all 10 documents annually and auto-suspend any account with a lapsed document.",
      },
      {
        q: "What is the in-app SOS feature?",
        a: "During any active trip you can tap SOS to share your live location with the Rajlo safety team and your trusted contact. In a life-threatening emergency, dial 119 (Police) or 110 (Fire & Ambulance) immediately.",
      },
      {
        q: "How do I report a safety concern?",
        a: "Open the trip in your Ride History and tap Report an issue. Every report is investigated and we may suspend an account pending review. See the full Safety policy for details.",
      },
      {
        q: "Can I share my live trip with someone?",
        a: "Yes — tap Share trip during any active ride to send a tracking link to a trusted contact. They'll see the route, ETA, and driver/vehicle details.",
      },
    ],
  },
  {
    title: "Account & billing",
    blurb: "Passwords, profiles, receipts.",
    faqs: [
      {
        q: "How do I reset my password?",
        a: "Tap Sign in, then Forgot password — we'll email you a reset link. The link expires after 15 minutes for security.",
      },
      {
        q: "How do I update my phone number or email?",
        a: "Open Profile → Account settings, edit the field, and we'll send a verification code to the new address before saving the change.",
      },
      {
        q: "Where can I see my trip receipts?",
        a: "Every completed trip appears in your Ride History with a downloadable receipt showing fare, parish breakdown, driver, vehicle, and timestamps.",
      },
      {
        q: "How do I delete my Rajlo account?",
        a: "Profile → Account settings → Delete account. We retain trip records (receipts, audit data) as required by Jamaican tax and regulatory rules — see the Privacy Policy for details.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative overflow-hidden bg-rajlo-red py-20 text-white">
        <ArcWatermark size={620} variant="white" className="absolute -right-32 -bottom-40" />
        <div className="relative mx-auto max-w-6xl px-4 text-center">
          <p className="font-secondary text-xs font-bold uppercase tracking-wider text-white/80">
            Help center
          </p>
          <h1 className="mt-3 text-5xl font-extrabold tracking-tight md:text-6xl">
            How can we help?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">
            Answers to common rider, driver, safety, and account questions —
            and a fast path to a human if you need one.
          </p>

          {/* Quick category jump */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {CATEGORIES.map((c) => (
              <a
                key={c.title}
                href={`#${slugify(c.title)}`}
                className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/20"
              >
                {c.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Categories with FAQs */}
      <section className="mx-auto max-w-4xl px-4 py-20">
        {CATEGORIES.map((category) => (
          <div
            key={category.title}
            id={slugify(category.title)}
            className="mb-16 scroll-mt-24"
          >
            <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
              {category.title}
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
              {category.blurb}
            </h2>

            <div className="mt-8 space-y-3">
              {category.faqs.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-rajlo-red"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-bold md:text-lg">
                    {item.q}
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-rajlo-red transition-transform duration-300 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-4 text-base leading-relaxed text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Still stuck? */}
      <section className="bg-surface-soft py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="grid gap-8 md:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-line bg-surface p-8">
              <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                Still stuck?
              </p>
              <h3 className="mt-3 text-2xl font-extrabold tracking-tight">
                Talk to a real person.
              </h3>
              <p className="mt-3 text-muted">
                Our support team responds within 24 hours, faster during the day.
              </p>
              <Link
                href="/contact"
                className="mt-6 inline-flex rounded-full bg-rajlo-red px-6 py-3 text-sm font-bold text-white hover:bg-primary-hover"
              >
                Contact support →
              </Link>
            </div>

            <div className="rounded-3xl border border-rajlo-red/20 bg-primary-soft/40 p-8">
              <p className="font-secondary text-xs font-bold uppercase tracking-wider text-rajlo-red">
                Emergency
              </p>
              <h3 className="mt-3 text-2xl font-extrabold tracking-tight">
                In immediate danger?
              </h3>
              <p className="mt-3 text-rajlo-black">
                Call <strong>119</strong> (Police) or <strong>110</strong> (Fire & Ambulance) immediately.
                Use the in-app SOS to share your live location with us and your trusted contact.
              </p>
              <Link
                href="/legal/safety-disclaimer-emergency-policy"
                className="mt-6 inline-flex rounded-full border border-rajlo-red px-6 py-3 text-sm font-bold text-rajlo-red hover:bg-white"
              >
                Read the Safety policy
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
