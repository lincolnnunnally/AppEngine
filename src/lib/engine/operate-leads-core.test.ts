import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { leadStatsPassClaims, OPERATE_STATS_AUDIENCE, parseLeadStats } from "./operate-leads-core.ts";

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
});
