import { test } from "node:test";
import assert from "node:assert/strict";
import { MARKETING_SITES, monthStartUtc, summarizeSites, summarizeSocial, sumUsage, type PieceRow } from "./marketing-core.ts";

const NOW = new Date("2026-11-24T18:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

test("summarizeSites counts last 7 days, queue, next and last per site, and demand this month", () => {
  const rows: PieceRow[] = [
    { app: "furfriend", slug: "a", title: "A", status: "published", published_at: ago(2) },
    { app: "furfriend", slug: "b", title: "B", status: "published", published_at: ago(24 * 9) },
    { app: "furfriend", slug: "c", title: "C", status: "scheduled", publish_at: ago(-30), source: "demand", created_at: ago(1) },
    { app: "furfriend", slug: "d", title: "D", status: "scheduled", publish_at: ago(-5), source: "demand", created_at: ago(24 * 30) },
    { app: "furfriend", slug: "e", title: "E", status: "published", published_at: ago(-2) }
  ];
  const fur = summarizeSites(rows, NOW).find((s) => s.app === "furfriend")!;
  assert.equal(fur.published7d, 1, "future-dated published rows and old ones do not count");
  assert.equal(fur.queued, 2);
  assert.deepEqual(fur.next, { title: "D", at: ago(-5) });
  assert.deepEqual(fur.last, { title: "A", at: ago(2), url: "https://furfriend.pet/guides/a" });
  assert.equal(fur.demandThisMonth, 1, "only demand guides written since the 1st");
  const old = summarizeSites([{ app: "laser", slug: "z", title: "Z", status: "published", published_at: ago(24 * 90) }], NOW).find((s) => s.app === "laser")!;
  assert.equal(old.published7d, 0);
  assert.equal(old.last?.title, "Z", "a piece older than the reporting window is still the latest");
  const empty = summarizeSites([], NOW).find((s) => s.app === "laser")!;
  assert.equal(empty.next, null);
  assert.equal(empty.last, null);
});

test("every site is listed once with an https guides address", () => {
  assert.equal(new Set(MARKETING_SITES.map((s) => s.app)).size, MARKETING_SITES.length);
  for (const s of MARKETING_SITES) assert.match(s.guides, /^https:\/\/[^/]+\/(guides|articles)$/);
  assert.equal(monthStartUtc(NOW), "2026-11-01T00:00:00.000Z");
});

test("summarizeSocial groups by Page with counts, the latest link and the last error", () => {
  const pages = summarizeSocial(
    [
      { connection_id: "c1", status: "published", source: "library", content: "Title one\n\nblurb", post_url: "https://fb/1", created_at: ago(3) },
      { connection_id: "c1", status: "failed", error_message: "Facebook: token expired", created_at: ago(1) },
      { connection_id: "u1", status: "scheduled", created_at: ago(0.5) },
      { connection_id: "c1", status: "failed", source: "library", error_message: "Facebook: token expired", created_at: ago(0.2) },
      { connection_id: "zz", status: "published", created_at: ago(2) }
    ],
    { c1: "Church Connect", u1: "United Under God" }
  );
  assert.deepEqual(pages.map((p) => p.page), ["Church Connect", "United Under God", "Unknown channel"]);
  const cc = pages[0];
  assert.equal(cc.published, 1);
  assert.equal(cc.failed, 2);
  assert.equal(cc.automatic, 1, "a library post that failed was not shared");
  assert.deepEqual(cc.latest, { text: "Title one", url: "https://fb/1", at: ago(3) });
  assert.equal(cc.lastError, "Facebook: token expired");
  assert.equal(pages[1].scheduled, 1);
});

test("sumUsage adds tokens and counts guides", () => {
  assert.deepEqual(sumUsage([{ app: "a", input_tokens: 100, output_tokens: 50 }, { app: "b", input_tokens: 1, output_tokens: 2 }]), {
    guides: 2,
    inputTokens: 101,
    outputTokens: 52
  });
});
