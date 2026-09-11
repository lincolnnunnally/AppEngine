import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWeeklyGoal,
  chargeLooksRecurring,
  goalCentsForWeek,
  ladderCentsForWeek,
  mondayUnixContaining,
  nyMidnightUnix,
  weekIndexForMonday
} from "./weekly-revenue-goal.ts";

describe("weekly revenue goal", () => {
  it("treats Monday 2026-09-14 New York as week 0 at $1,000", () => {
    const start = nyMidnightUnix(2026, 9, 14);
    assert.equal(new Date(start * 1000).toISOString(), "2026-09-14T04:00:00.000Z");
    assert.equal(weekIndexForMonday(start), 0);
    assert.equal(ladderCentsForWeek(0), 100_000);
    assert.equal(ladderCentsForWeek(1), 125_000);
    assert.equal(ladderCentsForWeek(2), 156_250);
    assert.equal(goalCentsForWeek(-1, 99_999), 0);
    assert.equal(goalCentsForWeek(0, 200_000), 100_000);
    assert.equal(goalCentsForWeek(1, 200_000), 250_000);
    assert.equal(goalCentsForWeek(1, 0), 125_000);
  });

  it("puts Friday Sep 11 2026 in the week before the goal", () => {
    const now = new Date("2026-09-11T16:00:00Z");
    const monday = mondayUnixContaining(now);
    assert.equal(weekIndexForMonday(monday), -1);
    const report = buildWeeklyGoal({ charges: [], accounts: [], now });
    assert.equal(report.goalStarted, false);
    assert.equal(report.thisWeek.goalCents, 0);
    assert.equal(report.nextWeekGoalCents, 100_000);
    assert.match(report.thisWeek.label, /Sep 7/);
  });

  it("counts a Sep 14 charge in week 0 and a Sep 13 charge in last week", () => {
    const now = new Date("2026-09-16T15:00:00Z");
    const report = buildWeeklyGoal({
      now,
      accounts: [{ sourceId: "vault-laser", label: "Vault — Laser", state: "no_key" }],
      charges: [
        {
          created: nyMidnightUnix(2026, 9, 14) + 12 * 3600,
          amount: 4900,
          streamId: "churchconnect",
          streamLabel: "ChurchConnect Pro",
          streamSlug: "churchconnect",
          service: "Ministry Pro",
          invoice: "in_1"
        },
        {
          created: nyMidnightUnix(2026, 9, 13) + 20 * 3600,
          amount: 2000,
          streamId: "laser",
          streamLabel: "Laser Engrave Market",
          streamSlug: "laser-engrave-market",
          service: "Coaster"
        }
      ]
    });
    assert.equal(report.goalStarted, true);
    assert.equal(report.thisWeek.weekIndex, 0);
    assert.equal(report.thisWeek.goalCents, 100_000);
    assert.equal(report.thisWeek.actualCents, 4900);
    assert.equal(report.thisWeek.recurringCents, 4900);
    assert.equal(report.lastWeek.actualCents, 2000);
    assert.equal(report.gapCents, 95_100);
    assert.equal(report.percentOfGoal, 5);
    assert.ok(report.opportunities.some((item) => item.id === "gap"));
    assert.ok(report.opportunities.some((item) => item.id === "unread-stripe"));
    assert.ok(report.opportunities.some((item) => item.id === "laser-zero"));
    assert.ok(!report.opportunities.some((item) => item.id === "cc-zero"));
  });

  it("raises next week's target when this week beats the ladder", () => {
    const now = new Date("2026-09-16T15:00:00Z");
    const report = buildWeeklyGoal({
      now,
      accounts: [{ sourceId: "desk-env", label: "Desk", state: "ok" }],
      charges: [
        {
          created: nyMidnightUnix(2026, 9, 14) + 3600,
          amount: 200_000,
          streamId: "churchconnect",
          streamLabel: "ChurchConnect Pro",
          streamSlug: "churchconnect",
          invoice: "in_2"
        }
      ]
    });
    assert.equal(report.thisWeek.goalCents, 100_000);
    assert.equal(report.aheadCents, 100_000);
    assert.equal(report.nextWeekGoalCents, 250_000);
  });

  it("treats an invoice id as recurring", () => {
    assert.equal(chargeLooksRecurring({ invoice: "in_123" }), true);
    assert.equal(chargeLooksRecurring({ service: "Ministry Pro" }), true);
    assert.equal(chargeLooksRecurring({ service: "Walnut coaster" }), false);
  });
});
