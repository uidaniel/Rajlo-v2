import { LogoIcon } from "./logo";

/**
 * Decorative phone-frame mockup — used in the landing page app showcase.
 * Renders a rounded phone shell with a screen that the caller fills with
 * any UI preview. No real device chrome; SSR-friendly.
 */
export function PhoneMockup({
  children,
  rotate = 0,
  className = "",
}: {
  children: React.ReactNode;
  rotate?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative mx-auto w-[260px] shrink-0 rounded-[40px] bg-rajlo-black p-3 shadow-2xl ring-1 ring-white/10 ${className}`}
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
    >
      {/* Notch */}
      <div className="absolute left-1/2 top-3 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-rajlo-black" />
      {/* Screen */}
      <div className="relative aspect-[9/19] overflow-hidden rounded-[28px] bg-white">
        {children}
      </div>
    </div>
  );
}

/** Mock screen: rider request / fare summary */
export function RiderRequestScreen() {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 text-xs">
        <span className="font-bold">9:41</span>
        <LogoIcon height={16} className="text-rajlo-black" />
        <span className="font-semibold">100%</span>
      </div>
      <div className="flex-1 overflow-hidden p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Trip preview
        </p>
        <h3 className="mt-1 text-base font-extrabold leading-tight">
          Half-Way-Tree → Norman Manley
        </h3>
        <div className="mt-3 space-y-2">
          <div className="rounded-lg bg-surface-soft px-3 py-2">
            <p className="text-[9px] font-semibold uppercase text-muted">Pickup</p>
            <p className="text-xs font-semibold">Half-Way-Tree, St. Andrew</p>
          </div>
          <div className="rounded-lg bg-surface-soft px-3 py-2">
            <p className="text-[9px] font-semibold uppercase text-muted">Dropoff</p>
            <p className="text-xs font-semibold">Norman Manley Airport</p>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`flex-1 rounded-md border py-1.5 text-center text-[10px] font-bold ${
                n === 2
                  ? "border-rajlo-red bg-primary-soft text-rajlo-red"
                  : "border-line bg-surface text-foreground"
              }`}
            >
              {n}
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-rajlo-black p-3 text-white">
          <p className="text-[9px] font-semibold uppercase text-white/70">Total</p>
          <p className="text-2xl font-extrabold">JMD 2,400</p>
          <p className="text-[10px] text-white/70">Parish + 2 seats</p>
        </div>
      </div>
      <div className="border-t border-line p-3">
        <button className="w-full rounded-full bg-rajlo-red py-2.5 text-xs font-bold text-white">
          Confirm ride
        </button>
      </div>
    </div>
  );
}

/** Mock screen: live driver match */
export function DriverMatchScreen() {
  return (
    <div className="relative h-full overflow-hidden bg-gradient-to-br from-rajlo-red to-[#a30100] text-white">
      <div className="flex items-center justify-between bg-rajlo-red/40 px-4 py-3 text-xs">
        <span className="font-bold">9:42</span>
        <LogoIcon height={16} className="text-white" />
        <span className="font-semibold">100%</span>
      </div>

      <div className="absolute inset-x-0 top-1/3 flex flex-col items-center gap-3">
        <div className="relative h-24 w-24 rounded-full bg-white/15 ring-4 ring-white/30 ring-offset-4 ring-offset-rajlo-red">
          <div className="absolute inset-0 animate-ping rounded-full bg-white/20" />
          <div className="absolute inset-0 grid place-items-center text-2xl font-extrabold">
            MK
          </div>
        </div>
        <p className="text-base font-extrabold">Matching driver…</p>
        <p className="text-xs text-white/80">Verified red-plate · 4 min away</p>
      </div>

      <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-white/15 p-3 backdrop-blur">
        <p className="text-[10px] font-semibold uppercase text-white/70">
          Driver
        </p>
        <p className="text-sm font-bold">Marlon K.</p>
        <p className="text-[10px] text-white/70">Toyota Axio · PP1234 · 4.93 ★</p>
      </div>
    </div>
  );
}

/** Mock screen: TA compliance dashboard */
export function ComplianceScreen() {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 text-xs">
        <span className="font-bold">9:41</span>
        <LogoIcon height={16} className="text-rajlo-black" />
        <span className="font-semibold">100%</span>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden p-3">
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted">
            Compliance
          </p>
          <h3 className="text-base font-extrabold">All clear</h3>
        </div>
        {[
          ["TA Franchise", "Apr 2027", "good"],
          ["TA Driver Badge", "Mar 2027", "good"],
          ["Cert. of Fitness", "Feb 2027", "good"],
          ["Insurance (PPV)", "Aug 2026", "warn"],
          ["Driver's Licence", "2031", "good"],
          ["Police Record", "On file", "good"],
        ].map(([label, expiry, state]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
          >
            <div>
              <p className="text-[10px] font-bold">{label}</p>
              <p className="text-[9px] text-muted">{expiry}</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${
                state === "warn"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {state === "warn" ? "renew" : "valid"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
