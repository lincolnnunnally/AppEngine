"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

type RailItem = { label: string; href: string };
type RailGroup = { label: string; items: RailItem[] };

// Operator rail — the full factory cockpit. Shown only to owner/admin.
const OPERATOR_GROUPS: RailGroup[] = [
  { label: "Home", items: [{ label: "Dashboard", href: "/" }, { label: "Canonical status", href: "/canonical-status" }] },
  {
    label: "Intake",
    // One unified entrance (the conversation lives at "/"). The standalone form is
    // the fallback; both intake routes still exist but are no longer two front doors.
    items: [{ label: "Intake form", href: "/problem-intake-lite" }]
  },
  {
    label: "Build",
    items: [
      { label: "Orchestrator", href: "/orchestrator" },
      { label: "Builder", href: "/builder" },
      { label: "Owner control", href: "/owner-control-center" }
    ]
  },
  {
    label: "Ecosystem",
    items: [
      { label: "Module catalog", href: "/module-catalog" },
      { label: "Life Core", href: "/life-core" }
    ]
  }
];

// Settings sits in the rail footer, rendered smaller. Operator-only.
const SETTINGS_GROUP: RailGroup = {
  label: "Settings",
  items: [
    { label: "Integrations", href: "/integrations" },
    { label: "Admin", href: "/admin" }
  ]
};

// Consumer rail — a single entrance (the unified conversation at "/"). No more
// problem-vs-build fork, and no operator jargon (orchestrator, builder, admin,
// catalog) ever reaches a customer.
const CONSUMER_GROUPS: RailGroup[] = [
  {
    label: "Home",
    items: [
      { label: "Start an app", href: "/" },
      { label: "Your apps", href: "/account" }
    ]
  }
];

const OPERATOR_BRAND = "App Engine";
const CONSUMER_BRAND = "We Succeed";

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

function sectionLabel(pathname: string, groups: RailGroup[], fallback: string): string {
  const items = groups.flatMap((group) => group.items);
  const match = items.find((item) => isActive(pathname, item.href));
  return match ? match.label : fallback;
}

export default function AppShell({ children, isOperator = true }: { children: ReactNode; isOperator?: boolean }) {
  const pathname = normalizePath(usePathname());
  const [open, setOpen] = useState(false);

  const navGroups = isOperator ? OPERATOR_GROUPS : CONSUMER_GROUPS;
  const settingsGroup = isOperator ? SETTINGS_GROUP : null;
  const brand = isOperator ? OPERATOR_BRAND : CONSUMER_BRAND;
  const labelGroups = settingsGroup ? [...navGroups, settingsGroup] : navGroups;

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
            {brand}
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
          <nav className="rail-nav" aria-label={isOperator ? "Operator navigation" : "Navigation"}>
            {navGroups.map((group) => (
              <div className="rail-group" key={group.label}>
                <p className="rail-group-label">{group.label}</p>
                {group.items.map((item) => renderItem(item))}
              </div>
            ))}
          </nav>

          {settingsGroup ? (
            <div className="rail-foot">
              <div className="rail-group">
                <p className="rail-group-label">{settingsGroup.label}</p>
                {settingsGroup.items.map((item) => renderItem(item, "rail-item-sm"))}
              </div>
              <p className="rail-identity">Owner</p>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <h2 className="app-header-title">{sectionLabel(pathname, labelGroups, brand)}</h2>
          {/* Reserved slot for a future primary action — intentionally empty in Step 1. */}
          <div className="app-header-action" aria-hidden="true" />
        </header>
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
