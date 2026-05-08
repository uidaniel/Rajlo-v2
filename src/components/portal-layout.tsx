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
      {/* Mobile gutter mirrors the top navbar's `px-4` so the
         page content lines up with the logo + menu button on the
         left edge. Desktop keeps the tighter halved `px-2` since
         the sidebar already provides visual breathing room. */}
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-2 md:py-6">
        {children}
      </div>
    </MobileDrawer>
  );
}