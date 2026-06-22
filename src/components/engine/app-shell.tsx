"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

type RailItem = { label: string; href: string };
type RailGroup = { label: string; items: RailItem[] };

// Step 1 rail map — operator routes that exist today only (see spec Appendix A).
// Later steps add Portfolio / Build sub-pages / Ship as those routes are created.
const NAV_GROUPS: RailGroup[] = [
  { label: "Home", items: [{ label: "Dashboard", href: "/" }, { label: "Canonical status", href: "/canonical-status" }] },
  {
    label: "Intake",
    items: [
      { label: "Vision intake", href: "/opportunity-intake" },
      { label: "Problem intake", href: "/problem-intake-lite" }
    ]
  },
  {
    label: "Build",
    items: [
      { label: "Builder", href: "/builder" },
      { label: "Owner control", href: "/owner-control-center" }
    ]
  },
  { label: "Ecosystem", items: [{ label: "Life Core", href: "/life-core" }] }
];

// Settings sits in the rail footer, rendered smaller.
const SETTINGS_GROUP: RailGroup = {
  label: "Settings",
  items: [{ label: "Admin", href: "/admin" }]
};

function normalizePath(pathname: string | null): string {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sectionLabel(pathname: string): string {
  const items = [...NAV_GROUPS, SETTINGS_GROUP].flatMap((group) => group.items);
  const match = items.find((item) => isActive(pathname, item.href));
  return match ? match.label : "App Engine";
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = normalizePath(usePathname());
  const [open, setOpen] = useState(false);

  const renderItem = (item: RailItem, extraClass = "") => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`rail-item${extraClass ? ` ${extraClass}` : ""}${active ? " active" : ""}`}
        aria-current={active ? "page" : undefined}
        onClick={() => setOpen(false)}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <div className="app-shell">
      <aside className="app-rail" data-open={open ? "true" : "false"}>
        <div className="rail-brand">
          <Link className="rail-brand-mark" href="/" onClick={() => setOpen(false)}>
            App Engine
          </Link>
          <button
            type="button"
            className="rail-toggle"
            aria-expanded={open}
            aria-controls="rail-panel"
            onClick={() => setOpen((value) => !value)}
          >
            Menu
          </button>
        </div>

        <div className="rail-panel" id="rail-panel">
          <nav className="rail-nav" aria-label="Operator navigation">
            {NAV_GROUPS.map((group) => (
              <div className="rail-group" key={group.label}>
                <p className="rail-group-label">{group.label}</p>
                {group.items.map((item) => renderItem(item))}
              </div>
            ))}
          </nav>

          <div className="rail-foot">
            <div className="rail-group">
              <p className="rail-group-label">{SETTINGS_GROUP.label}</p>
              {SETTINGS_GROUP.items.map((item) => renderItem(item, "rail-item-sm"))}
            </div>
            <p className="rail-identity">Owner</p>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <h2 className="app-header-title">{sectionLabel(pathname)}</h2>
          {/* Reserved slot for a future primary action — intentionally empty in Step 1. */}
          <div className="app-header-action" aria-hidden="true" />
        </header>
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
