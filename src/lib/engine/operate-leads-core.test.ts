import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  leadStatsPassClaims,
  OPERATE_STATS_AUDIENCE,
  parseLeadStats,
  percentOf,
  responseRate,
  winRate
} from "./operate-leads-core.ts";

describe("cockpit Local Leads read", () => {
  it("mints a short owner pass Operate can never redeem as a sign-in", () => {
    const claims = leadStatsPassClaims(" Owner@Example.test ", 1000, "j1");
    assert.equal(claims.aud, OPERATE_STATS_AUDIENCE);
    assert.notEqual(claims.aud, "operate");
    assert.equal(claims.iss, "appengine");
    assert.equal(claims.email, "owner@example.test");
    assert.equal((claims.exp as number) - (claims.iat as number), 120);
  });

  it("reads Operate's totals and refuses anything that is not a real number", () => {
    const stats = {
      requests: 12, requests30d: 5, matched: 9, prosTakingLeads: 2, accepted: 4, won: 2, lost: 1,
      wonAmountCents: 250000, feesTrackedCents: 12500, feeRateBps: 500, charging: false,
      shops: [{ name: "Kevin Huddleston Handyman", won: 2, wonAmountCents: 250000, feesTrackedCents: 12500 }]
    };
    const parsed = parseLeadStats({ ok: true, stats });
    assert.equal(parsed?.feesTrackedCents, 12500);
    assert.equal(parsed?.charging, false);
    assert.equal(parsed?.shops[0].name, "Kevin Huddleston Handyman");
    assert.equal(parseLeadStats({ ok: false, stats }), null);
    assert.equal(parseLeadStats({ ok: true, stats: { ...stats, won: "2" } }), null);
    assert.equal(parseLeadStats(null), null);
  });

  const base = {
    requests: 12, requests30d: 5, matched: 9, prosTakingLeads: 2, accepted: 4, won: 2, lost: 1,
    wonAmountCents: 250000, feesTrackedCents: 12500, feeRateBps: 500, charging: false, shops: []
  };
  const trends = {
    offered: 10, passed: 3, unmatched: 3,
    weekly: [{ weekStart: "2026-10-12", requests: 0 }, { weekStart: "2026-10-19", requests: 4 }],
    byTrade: [{ name: "Painting", requests: 7, matched: 5, won: 1 }],
    byTown: [{ name: "Vidalia", requests: 6, matched: 4, won: 2 }],
    notResponding: [{ name: "Quiet Paint Co", waiting: 2 }]
  };

  it("reads the trends when Operate sends them", () => {
    const parsed = parseLeadStats({ ok: true, stats: { ...base, ...trends } });
    assert.ok(parsed);
    assert.equal(parsed.unmatched, 3);
    assert.deepEqual(parsed.weekly, trends.weekly);
    assert.deepEqual(parsed.byTrade, trends.byTrade);
    assert.deepEqual(parsed.byTown, trends.byTown);
    assert.deepEqual(parsed.notResponding, trends.notResponding);
    assert.equal(winRate(parsed), 67);
    assert.equal(responseRate(parsed), 70);
  });

  it("an older Operate without trends still parses; the trends read as not reporting", () => {
    const parsed = parseLeadStats({ ok: true, stats: base });
    assert.ok(parsed);
    assert.equal(parsed.weekly, undefined);
    assert.equal(parsed.unmatched, undefined);
    assert.equal(parsed.byTown, undefined);
    assert.equal(responseRate(parsed), null);
  });

  it("refuses trends that are present but not real numbers", () => {
    const bad = (over: Record<string, unknown>) => parseLeadStats({ ok: true, stats: { ...base, ...trends, ...over } });
    assert.equal(bad({ unmatched: "3" }), null);
    assert.equal(bad({ offered: null }), null);
    assert.equal(bad({ weekly: "lots" }), null);
    assert.equal(bad({ weekly: [{ weekStart: "2026-10-19", requests: Number.NaN }] }), null);
    assert.equal(bad({ byTrade: [{ name: "Painting", requests: 7, matched: 5 }] }), null);
    assert.equal(bad({ byTown: [{ name: 4, requests: 1, matched: 1, won: 0 }] }), null);
    assert.equal(bad({ notResponding: [null] }), null);
  });

  it("a rate with nothing to divide by is unknown, not 0%", () => {
    assert.equal(percentOf(0, 0), null);
    assert.equal(percentOf(3, undefined), null);
    assert.equal(percentOf(0, 5), 0);
    const parsed = parseLeadStats({ ok: true, stats: { ...base, won: 0, lost: 0, ...trends, offered: 0, passed: 0 } });
    assert.ok(parsed);
    assert.equal(winRate(parsed), null);
    assert.equal(responseRate(parsed), null);
  });
});
