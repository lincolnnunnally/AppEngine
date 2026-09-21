import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asSlug,
  dollarsToCents,
  mergeVendorNotes,
  OperatorInputError,
  parseCampaignWrite,
  parseVendorSave,
  slugify
} from "./operator-input.ts";

describe("group buy operator input", () => {
  it("builds a slug and keeps an existing underscore slug", () => {
    assert.equal(slugify("Vidalia Churches"), "vidalia-churches");
    assert.equal(asSlug("amazon_business"), "amazon_business");
    assert.equal(asSlug("Paper Buy"), "paper-buy");
  });

  it("turns dollar amounts into cents", () => {
    assert.equal(dollarsToCents("12.50", "Price"), 1250);
    assert.equal(dollarsToCents("12", "Price"), 1200);
    assert.equal(dollarsToCents("$1,200.5", "Price"), 120050);
  });

  it("keeps a Stripe note marker when the operator edits the visible notes", () => {
    const existing = "Call the buyer.\n\n<!--gb-stripe:{\"account_id\":\"acct_1\"}-->";
    assert.equal(mergeVendorNotes(existing, "Confirmed drop-ship."), "Confirmed drop-ship.\n\n<!--gb-stripe:{\"account_id\":\"acct_1\"}-->");
  });

  it("parses a vendor save for a GPO and a drop-ship supplier", () => {
    const gpo = parseVendorSave({
      name: "Community GPO",
      kind: "gpo",
      join_url: "communitygpo.org/join",
      eligibility: "churches, nonprofits",
      membership_fee: "0"
    });

    assert.equal(gpo.slug, "community-gpo");
    assert.equal(gpo.kind, "gpo");
    assert.equal(gpo.join_url, "https://communitygpo.org/join");
    assert.deepEqual(gpo.eligibility, ["churches", "nonprofits"]);
    assert.equal(gpo.ships_to_member_addresses, false);

    const shipper = parseVendorSave({
      id: "ven_1",
      name: "Direct Supply",
      slug: "direct_supply",
      kind: "distributor",
      status: "active",
      ships_to_member_addresses: true,
      contact_email: "buyer@direct.example"
    });

    assert.equal(shipper.id, "ven_1");
    assert.equal(shipper.slug, "direct_supply");
    assert.equal(shipper.ships_to_member_addresses, true);
  });

  it("parses an open campaign with a new group and dollar SKU prices", () => {
    const parsed = parseCampaignWrite({
      title: "Copy paper",
      vendor: "direct_supply",
      group_name: "Vidalia Churches",
      group_kind: "church",
      min_units: "24",
      open: true,
      commission_percent: "2.5",
      items: [
        { sku: "", name: "", list_price: "", unit_price: "" },
        { sku: "CASE-12", name: "Paper case", list_price: "42.00", unit_price: "31.50" }
      ]
    });

    assert.equal(parsed.newGroup?.slug, "vidalia-churches");
    assert.equal(parsed.newGroup?.kind, "church");
    assert.equal(parsed.input.vendorSlug, "direct_supply");
    assert.equal(parsed.input.slug, "copy-paper");
    assert.equal(parsed.input.minUnits, 24);
    assert.equal(parsed.input.commissionBps, 250);
    assert.equal(parsed.input.open, true);
    assert.equal(parsed.input.items.length, 1);
    assert.equal(parsed.input.items[0].list_price_cents, 4200);
    assert.equal(parsed.input.items[0].unit_price_cents, 3150);
  });

  it("keeps the existing cents contract for a campaign that names its group", () => {
    const parsed = parseCampaignWrite({
      title: "Toner",
      slug: "toner-may",
      vendor: "direct_supply",
      group: "vidalia",
      min_units: 10,
      min_subtotal_cents: 5000,
      commission_bps: 100,
      open: false,
      items: [{ sku: "TN-760", name: "Toner", list_price_cents: 8000, unit_price_cents: 6400 }]
    });

    assert.equal(parsed.newGroup, null);
    assert.equal(parsed.input.groupSlug, "vidalia");
    assert.equal(parsed.input.minSubtotalCents, 5000);
    assert.equal(parsed.input.commissionBps, 100);
    assert.equal(parsed.input.open, false);
    assert.equal(parsed.input.items[0].unit_price_cents, 6400);
  });

  it("refuses a campaign with no group and a half-filled SKU", () => {
    assert.throws(() => parseCampaignWrite({ title: "Paper", vendor: "acme", min_units: 1 }), OperatorInputError);
    assert.throws(
      () =>
        parseCampaignWrite({
          title: "Paper",
          vendor: "acme",
          group: "vidalia",
          items: [{ sku: "CASE", name: "" }]
        }),
      /SKU row 1/
    );
  });
});
