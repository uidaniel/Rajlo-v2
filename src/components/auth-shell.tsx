import { Logo } from "./logo";
import { ArcWatermark } from "./arc-pattern";

type AuthShellProps = {
  /** Big page heading shown above the form card */
  title: string;
  /** One-line context shown under the title */
  subtitle?: string;
  /** Branding cue: "rider" or "driver" — drives accent on the side panel */
  audience?: "rider" | "driver" | "admin";
  /** Form / card content */
  children: React.ReactNode;
  /** Optional footer (e.g. "Forgot password?") */
  footer?: React.ReactNode;
};

/**
 * Shared shell for every auth screen (login, signup, verify, forgot, reset).
 * Two-column on desktop: red brand panel on the left, form card on the right.
 * Single column on mobile.
 */
export function AuthShell({
  title,
  subtitle,
  audience = "rider",
  children,
  footer,
}: AuthShellProps) {
  const audienceCopy =
    audience === "driver"
      ? {
          eyebrow: "For drivers",
          quote: "Earn on your terms with verified, fair-pay rides across Jamaica.",
        }
      : audience === "admin"
        ? {
            eyebrow: "Operations",
            quote: "Manage compliance, fare rules, and live trips from one console.",
          }
        : {
            eyebrow: "For riders",
            quote: "Book a ride anywhere, anytime. Verified red-plate drivers, transparent fares.",
          };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Brand panel (hidden on mobile, visible on md+) */}
      <aside className="relative hidden overflow-hidden bg-rajlo-red text-white md:flex md:flex-col md:justify-between md:p-12">
        <ArcWatermark
          size={620}
          variant="white"
          className="absolute -right-24 -bottom-32"
        />
        <Logo size="md" variant="white" tagline />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
            {audienceCopy.eyebrow}
          </p>
          <p className="mt-3 text-3xl font-extrabold leading-tight tracking-tight">
            {audienceCopy.quote}
          </p>
        </div>
        <p className="relative text-xs text-white/70">
          &copy; {new Date().getFullYear()} Rajlo · Kingston, Jamaica
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col px-6 py-8 md:px-12 md:py-12">
        <div className="md:hidden">
          <Logo size="sm" tagline />
        </div>

        <div className="flex flex-1 items-center justify-center py-8 md:py-0">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
              {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
            </div>

            <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm md:p-8">
              {children}
            </div>

            {footer && (
              <div className="mt-6 text-center text-sm text-muted">{footer}</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/** Standardized form field with label */
export function AuthField({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
  required,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none transition-colors focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15"
      />
    </label>
  );
}

/** Standardized primary submit button */
export function AuthSubmit({
  loading,
  disabled,
  children,
  onClick,
}: {
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full rounded-full bg-rajlo-red px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Just a moment…" : children}
    </button>
  );
}
