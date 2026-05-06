import Link from "next/link";

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
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  info: "bg-sky-50 text-sky-700",
};

export function ScreenTemplate({
  title,
  description,
  stats = [],
  items = [],
  actions = [],
}: ScreenTemplateProps) {
  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">{description}</p>
        {actions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-white"
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {stats.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={`${item.title}-${item.meta}`} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted">{item.meta}</p>
                </div>
                {item.status && (
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[item.status]}`}>
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