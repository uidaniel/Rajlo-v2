import { MobileDrawer } from "./mobile-drawer";
import type { IconName } from "./icons";

type NavLink = {
  label: string;
  href: string;
  icon: IconName;
};

type PortalLayoutProps = {
  title: string;
  subtitle: string;
  nav: NavLink[];
  children: React.ReactNode;
};

export function PortalLayout({ title, subtitle, nav, children }: PortalLayoutProps) {
  return (
    <MobileDrawer title={title} subtitle={subtitle} nav={nav}>
      <div className="mx-auto max-w-7xl px-4 py-4 md:py-6">
        {children}
      </div>
    </MobileDrawer>
  );
}