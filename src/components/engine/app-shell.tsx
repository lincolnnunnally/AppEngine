"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

type RailItem = { label: string; href: string };
type RailGroup = { label: string; items: RailItem[] };

// Operator rail — owner-first (redesign 2026-07-09). The four things the owner
// actually uses live at the top; every technical/factory surface is tucked into
// the collapsed "Engine room" fold below. Nothing was removed — just demoted.
const OPERATOR_GROUPS: RailGroup[] = [
  {
    label: "Command",
    items: [
      { label: "Dashboard", href: "/" },
      { label: "Reports", href: "/reports" },
      { label: "Domains", href: "/domains" },
      { label: "Keys & integrations", href: "/integrations" }
    ]
  },
  {
    label: "Create",
    items: [{ label: "Start something new", href: "/start" }]
  }
];

// The machinery — everything Claude uses to build, which the owner rarely
// opens. Rendered inside a collapsed fold so it stays reachable, not visible.
const ENGINE_ROOM_GROUP: RailGroup = {
  label: "Engine room",
  items: [
    { label: "Owner control", href: "/owner-control-center" },
    { label: "Builder", href: "/builder" },
    { label: "Orchestrator", href: "/orchestrator" },
    { label: "Module catalog", href: "/module-catalog" },
    { label: "Life Core", href: "/life-core" },
    { label: "Canonical status", href: "/canonical-status" },
    { label: "Intake form", href: "/problem-intake-lite" },
    { label: "Build an app (customer view)", href: "/build" },
    { label: "Your apps (customer view)", href: "/account" },
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
const CONSUMER_BRAND = "AppEngine";

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
  const engineRoom = isOperator ? ENGINE_ROOM_GROUP : null;
  const brand = isOperator ? OPERATOR_BRAND : CONSUMER_BRAND;
  const labelGroups = engineRoom ? [...navGroups, engineRoom] : navGroups;
  // Keep the fold open while the owner is ON an engine-room page.
  const engineRoomActive = Boolean(engineRoom?.items.some((item) => isActive(pathname, item.href)));

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
            {engineRoom ? (
              <details className="rail-group rail-fold" open={engineRoomActive}>
                <summary>{engineRoom.label}</summary>
                {engineRoom.items.map((item) => renderItem(item, "rail-item-sm"))}
              </details>
            ) : null}
          </nav>

          <div className="rail-foot">
            <div className="rail-identity-row">
              <p className="rail-identity">{isOperator ? "Owner view" : "Signed in"}</p>
              <a className="rail-signout" href="/api/auth/signout">Sign out</a>
            </div>
          </div>
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
