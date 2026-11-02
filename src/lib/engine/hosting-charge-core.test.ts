import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dunningStep, FREE_ALLOWANCE, hostingChargeReference, overageFor, previousPeriod } from "./hosting-charge-core.ts";

const GB = 1024 * 1024 * 1024;

describe("usage-based hosting", () => {
  it("charges nothing inside the free allowance", () => {
    const result = overageFor({ computeHours: 7.5, storageBytes: 50 * 1024 * 1024, transferBytes: GB }, 1.3);
    assert.equal(result.priceCents, 0);
    assert.equal(result.costCents, 0);
  });

  it("charges only the activity past the allowance, at cost × margin", () => {
    // A busy app: ~8 hours/day at 0.25 CU = 60 CU-hours → 50 over × 10.6¢ = 530¢ cost.
    const result = overageFor({ computeHours: 60, storageBytes: 0, transferBytes: 0 }, 1.3);
    assert.equal(result.computeHoursOver, 50);
    assert.equal(Math.round(result.costCents), 530);
    assert.equal(result.priceCents, 689);
  });

  it("adds storage and transfer past their allowances", () => {
    const result = overageFor(
      { computeHours: FREE_ALLOWANCE.computeHours, storageBytes: FREE_ALLOWANCE.storageBytes + GB, transferBytes: FREE_ALLOWANCE.transferBytes + 2 * GB },
      1
    );
    assert.equal(result.priceCents, 35 + 30);
  });

  it("never charges below cost or on garbage input", () => {
    assert.equal(overageFor({ computeHours: 20, storageBytes: 0, transferBytes: 0 }, 0.5).priceCents, 106);
    assert.equal(overageFor({ computeHours: Number.NaN, storageBytes: -5, transferBytes: 0 }, 1.3).priceCents, 0);
  });

  it("closes the previous month, one charge per app per month", () => {
    assert.equal(previousPeriod("2026-11"), "2026-10");
    assert.equal(previousPeriod("2026-01"), "2025-12");
    assert.equal(hostingChargeReference("job_1", "2026-10"), "hosting:job_1:2026-10");
  });
});

describe("out of credits", () => {
  const start = "2026-11-01T00:00:00.000Z";

  it("reminds on the first day, then weekly", () => {
    assert.equal(dunningStep({ firstUnpaidAt: start, lastRemindedAt: null, escalated: false }, new Date(start)).remind, true);
    assert.equal(
      dunningStep({ firstUnpaidAt: start, lastRemindedAt: start, escalated: false }, new Date("2026-11-05T00:00:00Z")).remind,
      false
    );
    assert.equal(
      dunningStep({ firstUnpaidAt: start, lastRemindedAt: start, escalated: false }, new Date("2026-11-08T00:00:00Z")).remind,
      true
    );
  });

  it("goes to Lincoln's to-do list once, after 30 days unpaid", () => {
    const day31 = new Date("2026-12-02T00:00:00Z");
    assert.equal(dunningStep({ firstUnpaidAt: start, lastRemindedAt: null, escalated: false }, day31).escalate, true);
    assert.equal(dunningStep({ firstUnpaidAt: start, lastRemindedAt: null, escalated: true }, day31).escalate, false);
    assert.equal(
      dunningStep({ firstUnpaidAt: start, lastRemindedAt: null, escalated: false }, new Date("2026-11-20T00:00:00Z")).escalate,
      false
    );
  });
});
