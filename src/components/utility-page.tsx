import Link from "next/link";
import { Logo } from "./logo";
import { ArcWatermark } from "./arc-pattern";

type UtilityPageProps = {
  /** Big numeric or short code shown above the headline (e.g. "404", "403"). */
  code?: string;
  title: string;
  body: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  /** Visual tone — defaults to a red hero. "muted" uses neutral surface. */
  tone?: "red" | "muted" | "black";
};

export function UtilityPage({
  code,
  title,
  body,
  primaryAction = { label: "Back home", href: "/" },
  secondaryAction,
  tone = "red",
}: UtilityPageProps) {
  const bg = tone === "red" ? "bg-rajlo-red" : tone === "black" ? "bg-rajlo-black" : "bg-surface-soft";
  const fg = tone === "muted" ? "text-foreground" : "text-white";
  const muted = tone === "muted" ? "text-muted" : "text-white/80";
  const watermarkVariant = tone === "muted" ? "red" : "white";

  return (
    <div className={`relative flex min-h-screen flex-col ${bg} ${fg}`}>
      <ArcWatermark
        size={620}
        variant={watermarkVariant}
        className="absolute -right-32 -bottom-40"
      />
      <header className="relative px-6 py-6 md:px-12">
        <Logo
          size="sm"
          variant={tone === "muted" ? "default" : "white"}
          tagline
        />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-6">
        <div className="max-w-xl text-center">
          {code && (
            <p className="text-7xl font-extrabold tracking-tight md:text-8xl">{code}</p>
          )}
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
          <p className={`mt-3 text-base ${muted}`}>{body}</p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={primaryAction.href}
              className={
                tone === "muted"
                  ? "rounded-full bg-rajlo-red px-7 py-3.5 text-sm font-semibold text-white hover:bg-primary-hover"
                  : "rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-rajlo-red hover:bg-white/95"
              }
            >
              {primaryAction.label}
            </Link>
            {secondaryAction && (
              <Link
                href={secondaryAction.href}
                className={
                  tone === "muted"
                    ? "rounded-full border border-line bg-surface px-7 py-3.5 text-sm font-semibold text-foreground hover:bg-surface-soft"
                    : "rounded-full border border-white/40 px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/10"
                }
              >
                {secondaryAction.label}
              </Link>
            )}
          </div>
        </div>
      </main>

      <footer className={`relative px-6 py-6 text-xs ${muted}`}>
        <p>&copy; {new Date().getFullYear()} Rajlo · Let&apos;s go!</p>
      </footer>
    </div>
  );
}
