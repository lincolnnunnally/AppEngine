import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateSiteVisits, nameableSiteIds, type SiteViewRow } from "./site-traffic-core.ts";

const NOW = new Date("2026-10-22T18:00:00Z");
const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";

function view(siteId: string | null, anon: string | null, source: string, at: string, host = "a.example"): SiteViewRow {
  return { anon_id: anon, props: siteId ? { site_id: siteId, host, source } : { host, source }, created_at: at };
}

describe("customer website traffic fold", () => {
  const rows: SiteViewRow[] = [
    view(SITE_A, "v1", "google", "2026-10-22T10:00:00Z"),
    view(SITE_A, "v1", "internal", "2026-10-22T10:01:00Z"),
    view(SITE_A, "v2", "search_other", "2026-10-21T09:00:00Z"),
    view(SITE_B, "v3", "social", "2026-10-20T09:00:00Z", "b.example"),
    view(SITE_B, null, "direct", "2026-10-22T11:00:00Z", "www.b.example"),
    view(null, "v9", "google", "2026-10-22T12:00:00Z") // no site id: skipped
  ];
  const fold = aggregateSiteVisits(rows, { days: 30, now: NOW });

  it("counts views, distinct visitors, and sources", () => {
    assert.deepEqual(fold.totals, {
      visits: 5,
      visitors: 3,
      fromGoogle: 1,
      fromSearch: 2,
      fromSocial: 1,
      direct: 1
    });
  });

  it("zero-fills a daily series, oldest first, ending today", () => {
    assert.equal(fold.daily.length, 30);
    assert.equal(fold.daily[29].date, "2026-10-22");
    assert.equal(fold.daily[29].visits, 3);
    assert.equal(fold.daily[28].visits, 1);
    assert.equal(fold.daily[0].visits, 0);
  });

  it("ranks sites by views and keeps the latest host", () => {
    assert.equal(fold.sites[0].siteId, SITE_A);
    assert.equal(fold.sites[0].visits, 3);
    assert.equal(fold.sites[0].visitors, 2);
    assert.equal(fold.sites[0].fromSearch, 2);
    assert.equal(fold.sites[1].siteId, SITE_B);
    assert.equal(fold.sites[1].host, "www.b.example");
    assert.equal(fold.sites[1].lastVisit, "2026-10-22T11:00:00Z");
  });

  it("returns honest zeros for no rows", () => {
    const empty = aggregateSiteVisits([], { days: 7, now: NOW });
    assert.equal(empty.totals.visits, 0);
    assert.equal(empty.sites.length, 0);
    assert.equal(empty.daily.length, 7);
  });

  it("only passes uuids on to the name lookup", () => {
    const ids = nameableSiteIds(
      [
        { siteId: SITE_A, host: "", visits: 1, visitors: 1, fromSearch: 0, lastVisit: "" },
        { siteId: "x),or=(id.neq.0", host: "", visits: 1, visitors: 1, fromSearch: 0, lastVisit: "" }
      ],
      25
    );
    assert.deepEqual(ids, [SITE_A]);
  });
});
