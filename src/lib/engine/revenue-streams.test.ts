import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyCharge } from "./revenue-streams.ts";

describe("revenue stream labels", () => {
  it("names Rally tennis lessons", () => {
    const hit = classifyCharge({
      amount: 6000,
      paid: true,
      description: "Rally tennis lesson — Vidalia"
    });
    assert.equal(hit.id, "rally");
  });

  it("keeps Toner Connect in the toner family", () => {
    const hit = classifyCharge({
      amount: 300,
      paid: true,
      description: "Toner Connect facilitated order"
    });
    assert.equal(hit.id, "toner");
  });

  it("names laser.engrave.market", () => {
    const hit = classifyCharge({
      amount: 3200,
      paid: true,
      description: "Order 1842 laser.engrave.market wall sign"
    });
    assert.equal(hit.id, "laser");
  });

  it("names backoffice.works as Operate / Backoffice", () => {
    const hit = classifyCharge({
      amount: 9900,
      paid: true,
      description: "backoffice.works monthly"
    });
    assert.equal(hit.id, "operate");
  });

  it("does not guess unlabeled charges", () => {
    const hit = classifyCharge({ amount: 1000, paid: true, description: null });
    assert.equal(hit.id, "unattributed");
  });
});
