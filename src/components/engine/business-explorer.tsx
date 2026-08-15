"use client";

import { useMemo, useState } from "react";
import type { DeckApp, DeckGrowth } from "@/lib/engine/owner-deck";

type SortKey = "name" | "family" | "status" | "people" | "active" | "new7" | "orders" | "help";

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

export function BusinessExplorer({
  apps,
  families
}: {
  apps: DeckApp[];
  families: Array<{ id: string; label: string }>;
}) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("");
  const [view, setView] = useState<"all" | "live" | "money" | "growing" | "help" | "quiet">("all");
  const [sort, setSort] = useState<SortKey>("people");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = apps.filter((app) => {
      if (family && app.family !== family) return false;
      if (view === "live" && app.status !== "live") return false;
      if (view === "money" && !(typeof app.ordersRecent === "number" && app.ordersRecent > 0)) return false;
      if (view === "growing" && app.growth !== "up") return false;
      if (view === "help" && app.inboxOpen + (app.ticketsOpen ?? 0) <= 0) return false;
      if (view === "quiet") {
        const quiet = app.status === "live" && (!app.reporting || app.users === 0 || app.users === null);
        if (!quiet) return false;
      }
      if (!q) return true;
      return [app.name, app.domain, app.url, app.familyLabel, app.statusLabel].join(" ").toLowerCase().includes(q);
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
                      : num(a.inboxOpen + (a.ticketsOpen ?? 0)) - num(b.inboxOpen + (b.ticketsOpen ?? 0));
      return dir === "desc" ? -pair : pair;
    });
    return ranked;
  }, [apps, query, family, view, sort, dir]);

  function toggle(next: SortKey) {
    if (sort === next) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(next);
      setDir(next === "name" || next === "family" ? "asc" : "desc");
    }
  }

  const mark = (key: SortKey) => (sort === key ? (dir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div>
      <div className="biz-toolbar">
        <input
          className="biz-search"
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
            ["quiet", "Quiet / not reporting"]
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
        {shown.length} of {apps.length} · click a column to sort · click a row to open that business
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
                <button type="button" className="dx-sort" onClick={() => toggle("help")}>
                  Help{mark("help")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={8} className="dx-note">
                  Nothing matches that search.
                </td>
              </tr>
            ) : (
              shown.map((app) => {
                const help = app.inboxOpen + (app.ticketsOpen ?? 0);
                return (
                  <tr key={app.slug} className="biz-row">
                    <td>
                      <a className="biz-name" href={`/apps/${app.slug}`}>
                        {app.name}
                      </a>
                      <div className="dx-domain">{app.domain || app.url || "no address yet"}</div>
                    </td>
                    <td>{app.familyLabel}</td>
                    <td>{app.statusLabel}</td>
                    <td className="dx-mono">{cell(app.users)}</td>
                    <td className="dx-mono">{cell(app.activeUsers30d)}</td>
                    <td className="dx-mono">
                      {cell(app.newUsers7d)}
                      {trend(app.growth)}
                    </td>
                    <td className="dx-mono">{cell(app.ordersRecent)}</td>
                    <td className="dx-mono">{help || (app.ticketsOpen === null && app.inboxOpen === 0 ? "—" : help)}</td>
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
