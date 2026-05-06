"use client";

import Link from "next/link";
import { useState } from "react";

type NavLink = {
  label: string;
  href: string;
};

type MobileDrawerProps = {
  title: string;
  subtitle: string;
  nav: NavLink[];
  children: React.ReactNode;
};

export function MobileDrawer({
  title,
  subtitle,
  nav,
  children,
}: MobileDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col md:grid md:grid-cols-[280px_1fr]">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3 md:hidden">
        <div className="flex-1">
          <Link href="/" className="text-sm font-bold text-primary tracking-wide">
            RAJLO <span className="text-xs font-normal text-muted">Let&apos;s go!</span>
          </Link>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-2 hover:bg-surface-soft"
          aria-label="Toggle menu"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </header>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 top-12 z-30 bg-black/50 md:hidden" onClick={() => setIsOpen(false)} />
      )}
      <aside
        className={`fixed top-12 left-0 z-40 w-72 h-[calc(100vh-3rem)] transform transition-transform md:static md:top-0 md:h-auto bg-surface border-b border-line md:border-r md:border-b-0 overflow-y-auto ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-4 md:sticky md:top-0 md:z-10 md:bg-surface">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-xs text-muted mt-1">{subtitle}</p>
        </div>
        <nav className="grid gap-1 p-4 border-t border-line md:border-t-0">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-soft hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
    </div>
  );
}
