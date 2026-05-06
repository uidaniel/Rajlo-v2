import Link from "next/link";
import { ArcWatermark } from "./arc-pattern";

type Stat = {
  label: string;
  value: string;
};

type ListItem = {
  title: string;
  meta: string;
  status?: "good" | "warn" | "info";
};

type ActionLink = {
  label: string;
  href: string;
};

type ScreenTemplateProps = {
  title: string;
  description: string;
  stats?: Stat[];
  items?: ListItem[];
  actions?: ActionLink[];
};

const statusStyles: Record<NonNullable<ListItem["status"]>, string> = {
  good: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  warn: "bg-amber-50 text-amber-800 ring-1 ring-amber-100",
  info: "bg-primary-soft text-rajlo-red ring-1 ring-rajlo-red/20",
};

export function ScreenTemplate({
  title,
  description,
  stats = [],
  items = [],
  actions = [],
}: ScreenTemplateProps) {
  return (
    <section className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-line bg-surface p-7">
        <ArcWatermark size={260} variant="red" className="absolute -right-12 -bottom-16 opacity-[0.05]" />
        <div className="relative">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>
          {actions.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {actions.map((action, i) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={
                    i === 0
                      ? "rounded-full bg-rajlo-red px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
                      : "rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-soft"
                  }
                >
                  {action.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      {stats.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{stat.label}</p>
              <p className="mt-2 text-2xl font-extrabold">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={`${item.title}-${item.meta}`} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-muted">{item.meta}</p>
                </div>
                {item.status && (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[item.status]}`}>
                    {item.status}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
