"use client";

import { useMemo, useState } from "react";
import type { DeckApp, DeckGrowth } from "@/lib/engine/owner-deck";

type SortKey = "name" | "family" | "status" | "people" | "active" | "new7" | "orders" | "money" | "help";
type ViewKey = "all" | "live" | "money" | "growing" | "help" | "quiet" | "doors";

// What one app's money looks like on this desk: a figure when a classifier can
// tell its charges apart, and nothing at all when it cannot. A missing
// classifier is never rendered as $0 — that reads as "earned nothing".
export type DeckRevenue = { revenue30d: number; charges30d: number };

const STATUS_RANK: Record<string, number> = {
  live: 0,
  deployed_awaiting_domain: 1,
  domain_owned_not_serving: 2,
  awaiting_url: 3,
  unknown: 4
};

function num(value: number | null | undefined): number {
  return typeof value === "number" ? value : -1;
}

function cell(value: number | null | undefined): string {
  return typeof value === "number" ? String(value) : "—";
}

function trend(growth: DeckGrowth): string {
  if (growth === "up") return " ↑";
  if (growth === "down") return " ↓";
  if (growth === "steady") return " →";
  return "";
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BusinessExplorer({
  apps,
  families,
  revenueBySlug,
  revenueReadable,
  initialQuery = "",
  initialView = "all",
  initialFamily = ""
}: {
  apps: DeckApp[];
  families: Array<{ id: string; label: string }>;
  // Keyed by revenue-stream slug, not app slug — several front doors share one
  // stream (the Toner family), and they should all show the platform's money.
  revenueBySlug?: Record<string, DeckRevenue>;
  // False when no Stripe key is readable: then every app's money is unknown,
  // which is a different statement from "this app has no classifier".
  revenueReadable?: boolean;
  initialQuery?: string;
  initialView?: ViewKey;
  initialFamily?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [family, setFamily] = useState(initialFamily);
  const [view, setView] = useState<ViewKey>(initialView);
  const [sort, setSort] = useState<SortKey>("people");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const shown = useMemo(() => {
    const revenueOf = (app: DeckApp): DeckRevenue | null =>
      app.revenueStreamSlug ? (revenueBySlug?.[app.revenueStreamSlug] ?? null) : null;
    const q = query.trim().toLowerCase();
    const filtered = apps.filter((app) => {
      if (family && app.family !== family) return false;
      if (view === "live" && app.status !== "live") return false;
      if (view === "money" && !(typeof app.ordersRecent === "number" && app.ordersRecent > 0)) return false;
      if (view === "growing" && app.growth !== "up") return false;
      if (view === "help" && app.inboxOpen + (app.ticketsOpen ?? 0) <= 0) return false;
      if (view === "doors" && !app.adminUrl) return false;
      if (view === "quiet") {
        const quiet = app.status === "live" && (!app.reporting || app.users === 0 || app.users === null);
        if (!quiet) return false;
      }
      if (!q) return true;
      return [app.name, app.slug, app.domain, app.url, app.familyLabel, app.statusLabel]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const ranked = [...filtered].sort((a, b) => {
      const pair =
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "family"
            ? a.familyLabel.localeCompare(b.familyLabel) || a.name.localeCompare(b.name)
            : sort === "status"
              ? (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || a.name.localeCompare(b.name)
              : sort === "people"
                ? num(a.users) - num(b.users)
                : sort === "active"
                  ? num(a.activeUsers30d) - num(b.activeUsers30d)
                  : sort === "new7"
                    ? num(a.newUsers7d) - num(b.newUsers7d)
                    : sort === "orders"
                      ? num(a.ordersRecent) - num(b.ordersRecent)
                      : sort === "money"
                        ? num(revenueOf(a)?.revenue30d) - num(revenueOf(b)?.revenue30d)
                        : num(a.inboxOpen + (a.ticketsOpen ?? 0)) - num(b.inboxOpen + (b.ticketsOpen ?? 0));
      return dir === "desc" ? -pair : pair;
    });
    return ranked;
  }, [apps, query, family, view, sort, dir, revenueBySlug]);

  function toggle(next: SortKey) {
    if (sort === next) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(next);
      setDir(next === "name" || next === "family" ? "asc" : "desc");
    }
  }

  const mark = (key: SortKey) => (sort === key ? (dir === "asc" ? " ▲" : " ▼") : "");
  const withDoors = apps.filter((app) => app.adminUrl).length;
  const filtering = Boolean(query.trim()) || Boolean(family) || view !== "all";

  return (
    <div>
      <div className="biz-toolbar">
        <input
          className="biz-search desk-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a business, domain, or family…"
          aria-label="Search businesses"
        />
        <select className="biz-select" value={family} onChange={(event) => setFamily(event.target.value)} aria-label="Family">
          <option value="">All families</option>
          {families.map((entry) => (
            <option value={entry.id} key={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>
      <div className="dx-chips">
        {(
          [
            ["all", "All"],
            ["live", "Live"],
            ["money", "Has orders"],
            ["growing", "Growing"],
            ["help", "People waiting"],
            ["quiet", "Quiet / not reporting"],
            ["doors", `Has an admin door (${withDoors})`]
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={`dx-chip${view === key ? " dx-chip--active" : ""}`}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="dx-note">
        {shown.length} of {apps.length} {apps.length === 1 ? "business" : "businesses"} · click a column to sort · every
        number below opens the place it comes from
        {filtering ? (
          <>
            {" · "}
            <button
              type="button"
              className="dx-linkish"
              onClick={() => {
                setQuery("");
                setFamily("");
                setView("all");
              }}
            >
              clear filters
            </button>
          </>
        ) : null}
      </p>
      <div className="dx-table-wrap">
        <table className="dx-table biz-table">
          <thead>
            <tr>
              <th>
                <button type="button" className="dx-sort" onClick={() => toggle("name")}>
                  Business{mark("name")}
                </button>
              </th>
              <th>
                <button type="button" className="dx-sort" onClick={() => toggle("family")}>
                  Family{mark("family")}
                </button>
              </th>
              <th>
                <button type="button" className="dx-sort" onClick={() => toggle("status")}>
                  Status{mark("status")}
                </button>
              </th>
              <th>
                <button type="button" className="dx-sort" onClick={() => toggle("people")}>
                  People{mark("people")}
                </button>
              </th>
              <th>
                <button type="button" className="dx-sort" onClick={() => toggle("active")}>
                  Active{mark("active")}
                </button>
              </th>
              <th>
                <button type="button" className="dx-sort" onClick={() => toggle("new7")}>
                  New 7d{mark("new7")}
                </button>
              </th>
              <th>
                <button type="button" className="dx-sort" onClick={() => toggle("orders")}>
                  Orders 30d{mark("orders")}
                </button>
              </th>
              <th>
                <button type="button" className="dx-sort" onClick={() => toggle("money")}>
                  Money 30d{mark("money")}
                </button>
              </th>
              <th>
                <button type="button" className="dx-sort" onClick={() => toggle("help")}>
                  Help{mark("help")}
                </button>
              </th>
              <th>Doors</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={10} className="dx-note">
                  Nothing matches that search.
                </td>
              </tr>
            ) : (
              shown.map((app) => {
                const dossier = `/apps/${app.slug}`;
                const revenue = app.revenueStreamSlug ? (revenueBySlug?.[app.revenueStreamSlug] ?? null) : null;
                const central = app.inboxOpen;
                const inApp = app.ticketsOpen;
                return (
                  <tr key={app.slug} className="biz-row">
                    <td>
                      <a className="biz-name" href={dossier}>
                        {app.name}
                      </a>
                      <div className="dx-domain">{app.domain || app.url || "no address yet"}</div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="dx-linkish"
                        onClick={() => setFamily(app.family)}
                        title={`Show only ${app.familyLabel}`}
                      >
                        {app.familyLabel}
                      </button>
                    </td>
                    <td>
                      <a className="dx-cell-link" href={`${dossier}#status`}>
                        {app.statusLabel}
                      </a>
                    </td>
                    <td className="dx-mono">
                      <a className="dx-cell-link" href={`${dossier}#doing`}>
                        {cell(app.users)}
                      </a>
                    </td>
                    <td className="dx-mono">
                      <a className="dx-cell-link" href={`${dossier}#doing`}>
                        {cell(app.activeUsers30d)}
                      </a>
                    </td>
                    <td className="dx-mono">
                      <a className="dx-cell-link" href={`${dossier}#doing`}>
                        {cell(app.newUsers7d)}
                        {trend(app.growth)}
                      </a>
                    </td>
                    <td className="dx-mono">
                      <a className="dx-cell-link" href={`${dossier}#doing`}>
                        {cell(app.ordersRecent)}
                      </a>
                    </td>
                    <td className="dx-mono">
                      {app.revenueStreamSlug ? (
                        <a
                          className="dx-cell-link"
                          href={`/reports/money?stream=${encodeURIComponent(app.revenueStreamSlug)}`}
                        >
                          {revenueReadable === false
                            ? "money dark"
                            : revenue && revenue.charges30d
                              ? money(revenue.revenue30d)
                              : "no labeled charges"}
                        </a>
                      ) : (
                        <span
                          className="dx-note"
                          title="No classifier attributes charges to this app, so its revenue cannot be shown. This is not $0."
                        >
                          not wired
                        </span>
                      )}
                    </td>
                    <td className="dx-mono">
                      {central > 0 ? (
                        <a className="dx-cell-link" href={`/inbox?app=${encodeURIComponent(app.slug)}`}>
                          {central} central
                        </a>
                      ) : (
                        <span className="dx-note">—</span>
                      )}
                      {typeof inApp === "number" && inApp > 0 ? (
                        <div className="dx-note" title="Open in the app's own queue — a different queue from the central inbox.">
                          {inApp} in-app
                        </div>
                      ) : null}
                    </td>
                    <td className="dx-doors">
                      {app.url ? (
                        <a className="dx-doorlink" href={app.url} target="_blank" rel="noreferrer" title="Open the app itself">
                          Open ↗
                        </a>
                      ) : null}
                      {app.adminUrl ? (
                        <a
                          className="dx-doorlink dx-doorlink--admin"
                          href={app.adminUrl}
                          target={app.adminUrl.startsWith("/") ? undefined : "_blank"}
                          rel="noreferrer"
                          title={app.adminNote || `${app.name}'s own admin`}
                        >
                          {app.family === "toner" ? "Toner admin ↗" : "Admin ↗"}
                        </a>
                      ) : (
                        <span className="dx-note" title={app.adminReason}>
                          {app.adminState === "no_address" ? "admin, no address" : "no admin door"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
