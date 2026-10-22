import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { monthlyCents, summarizeSubscriptions, type StripeSubscription } from "./recurring-revenue-core.ts";

describe("monthly recurring normalization", () => {
  it("keeps a monthly price as is", () => {
    assert.equal(monthlyCents(2900, { interval: "month", interval_count: 1 }), 2900);
  });

  it("divides a yearly price by twelve", () => {
    assert.equal(monthlyCents(12000, { interval: "year" }), 1000);
  });

  it("scales a weekly price by 52/12", () => {
    assert.equal(monthlyCents(1200, { interval: "week" }), 5200);
  });

  it("respects interval_count (every 3 months)", () => {
    assert.equal(monthlyCents(9000, { interval: "month", interval_count: 3 }), 3000);
  });

  it("refuses an unknown interval instead of guessing", () => {
    assert.equal(monthlyCents(1000, { interval: "fortnight" }), null);
    assert.equal(monthlyCents(1000, null), null);
  });
});

describe("paying customers and MRR", () => {
  const subs: StripeSubscription[] = [
    {
      id: "sub_1",
      customer: "cus_a",
      items: { data: [{ quantity: 2, price: { unit_amount: 2500, currency: "usd", recurring: { interval: "month" }, product: "prod_web" } }] }
    },
    {
      id: "sub_2",
      customer: "cus_b",
      items: { data: [{ quantity: 1, price: { unit_amount: 60000, currency: "usd", recurring: { interval: "year" }, product: "prod_web" } }] }
    },
    {
      id: "sub_3",
      customer: { id: "cus_a" },
      items: {
        data: [
          { quantity: 1, price: { unit_amount: 1000, currency: "usd", recurring: { interval: "month" }, product: { id: "prod_mail", name: "Email forwarding" } } },
          { quantity: 1, price: { unit_amount: null, currency: "usd", recurring: { interval: "month" }, product: "prod_metered" } }
        ]
      }
    },
    {
      id: "sub_4",
      customer: "cus_c",
      items: { data: [{ quantity: 1, price: { unit_amount: 500, currency: "eur", recurring: { interval: "month" }, product: "prod_eu" } }] }
    }
  ];
  const fold = summarizeSubscriptions(subs, { prod_web: "Website plan" });

  it("counts distinct paying customers and active subscriptions", () => {
    assert.equal(fold.payingCustomers, 3);
    assert.equal(fold.activeSubscriptions, 4);
  });

  it("sums quantity-aware, monthly-normalized USD MRR", () => {
    // 2 × $25 + $600/12 + $10 = $110
    assert.equal(fold.mrrCents, 11000);
  });

  it("does not guess unpriced lines or convert other currencies", () => {
    assert.equal(fold.unpricedItems, 1);
    assert.deepEqual(fold.otherCurrencies, ["EUR"]);
  });

  it("groups by product name, most MRR first", () => {
    assert.equal(fold.products[0].name, "Website plan");
    assert.equal(fold.products[0].mrrCents, 10000);
    assert.equal(fold.products[0].customers, 2);
    assert.equal(fold.products[0].subscriptions, 2);
    assert.equal(fold.products[1].name, "Email forwarding");
    assert.ok(fold.products.some((product) => product.name === "prod_metered" && product.mrrCents === 0));
  });
});
