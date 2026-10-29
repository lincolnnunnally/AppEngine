import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCampaignKit,
  cleanBrief,
  copyProblems,
  fitSentences,
  LED_WALL_EXAMPLE,
  mergePolishedCopy,
  polishableCopy,
  productTopic,
  type CampaignKit
} from "./campaign-builder-core.ts";

function ledKit(): CampaignKit {
  const cleaned = cleanBrief(LED_WALL_EXAMPLE);
  assert.equal(cleaned.ok, true);
  if (!cleaned.ok) throw new Error("LED brief rejected");
  return buildCampaignKit(cleaned.brief);
}

function allCopy(kit: CampaignKit): string {
  return JSON.stringify({ p: kit.positioning, e: kit.emails, l: kit.landing });
}

describe("Campaign Builder brief", () => {
  it("rejects a bad brief with plain sentences", () => {
    const empty = cleanBrief({});
    assert.equal(empty.ok, false);
    if (!empty.ok) {
      assert.ok(empty.errors.includes("Add the company name."));
      assert.ok(empty.errors.includes("Say who this is for."));
      for (const error of empty.errors) assert.match(error, /^[A-Z].*\.$/);
    }
    assert.equal(cleanBrief(null).ok, false);
    const badUrl = cleanBrief({ ...LED_WALL_EXAMPLE, landingUrl: "http://example.com/x" });
    assert.equal(badUrl.ok, false);
    if (!badUrl.ok) assert.deepEqual(badUrl.errors, ["The landing page address must be a full https:// address."]);
    const badBidders = cleanBrief({ ...LED_WALL_EXAMPLE, bidders: 2.5 });
    assert.equal(badBidders.ok, false);
  });

  it("cleans text, splits rules, and keeps proof lines whole", () => {
    const result = cleanBrief({
      company: "  Acme  Bakery ",
      product: "Wedding cakes for small weddings",
      audience: "couples in Savannah",
      offer: "One tasting, three designs, you pick",
      proof: "Baking since 1998, in the same shop\nFamily owned",
      rules: "free, best, free",
      bidders: "2"
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.brief.company, "Acme Bakery");
    assert.deepEqual(result.brief.proof, ["Baking since 1998, in the same shop", "Family owned"]);
    assert.deepEqual(result.brief.rules, ["free", "best"]);
    assert.equal(result.brief.bidders, 2);
  });
});

describe("Campaign Builder kit", () => {
  it("has the full shape: positioning, three emails, landing, dashboard, checklist", () => {
    const kit = ledKit();
    assert.equal(kit.version, 1);
    assert.equal(kit.generatedBy, "template");
    assert.ok(kit.positioning.oneLiner && kit.positioning.problem && kit.positioning.promise);
    assert.equal(kit.emails.length, 3);
    assert.deepEqual(kit.emails.map((e) => e.sendDay), [0, 4, 10]);
    assert.equal(kit.landing.benefits.length, 4);
    assert.ok(kit.landing.steps.length >= 3);
    assert.ok(kit.landing.faq.length >= 3);
    assert.ok(kit.landing.formFields.some((f) => f.type === "email" && f.required));
    assert.deepEqual(
      kit.dashboard.stages.map((s) => s.key),
      ["sent", "opened", "clicked", "requested", "bidding", "chosen"]
    );
    assert.equal(kit.dashboard.sendPlan.startPerDay, 10);
    assert.ok(kit.checklist.length >= 5);
  });

  it("gives every email two different subjects, a preview, a body and a working link", () => {
    const kit = ledKit();
    for (const email of kit.emails) {
      assert.ok(email.subjectA.length > 0 && email.subjectB.length > 0);
      assert.notEqual(email.subjectA.toLowerCase(), email.subjectB.toLowerCase());
      assert.ok(email.subjectA.length <= 78 && email.subjectB.length <= 78);
      assert.ok(email.preview.length > 0);
      assert.ok(email.ctaLabel.length > 0);
      assert.ok(email.ctaUrl.startsWith("https://www.unitedundergod.org/church-av/led-wall?"));
      assert.ok(email.body.includes(email.ctaUrl));
    }
    const subjects = kit.emails.flatMap((e) => [e.subjectA, e.subjectB]);
    assert.equal(new Set(subjects).size, subjects.length);
  });

  it("keeps the landing title and description inside search limits, for long and short briefs", () => {
    const briefs = [
      LED_WALL_EXAMPLE,
      { company: "Ab", product: "Widget", audience: "bakers", offer: "We make it easy to start" },
      {
        company: "The Very Long Name Community Development Cooperative of the Southeast",
        product: "Commercial-grade solar canopies, battery storage and maintenance plans for rural fellowship halls and gyms",
        audience: "rural congregations, fellowship halls and community centers across Georgia, Alabama, Tennessee and the Carolinas",
        offer: "Share your building details once and get matched with vetted installers who all quote the same written scope",
        bidders: 4
      }
    ];
    for (const raw of briefs) {
      const cleaned = cleanBrief(raw);
      assert.equal(cleaned.ok, true);
      if (!cleaned.ok) continue;
      const kit = buildCampaignKit(cleaned.brief);
      const meta = kit.landing.metaDescription;
      assert.ok(meta.length >= 120 && meta.length <= 165, `meta ${meta.length}: ${meta}`);
      assert.ok(kit.landing.title.length > 0 && kit.landing.title.length <= 60, kit.landing.title);
      assert.ok(kit.landing.slug.length > 0);
    }
  });

  it("is deterministic", () => {
    assert.deepEqual(ledKit(), ledKit());
  });

  it("LED wall example says who we are and that three companies will bid, and passes its own rules", () => {
    const kit = ledKit();
    const copy = allCopy(kit);
    assert.match(copy, /United Under God/);
    assert.match(copy, /\bthree\b/i);
    assert.match(kit.emails[0].body, /We are United Under God/);
    assert.match(kit.emails[0].subjectA, /^Three companies ready to bid/);
    assert.equal(kit.landing.slug, "led-wall");
    assert.deepEqual(copyProblems(kit, LED_WALL_EXAMPLE.rules), []);
    assert.doesNotMatch(copy, /\bfree\b/i);
    assert.doesNotMatch(copy, /\bAI\b/);
    assert.doesNotMatch(copy.replace(/https?:[^"\s]+/g, ""), /\$\s?\d/);
    assert.ok(kit.checklist.some((line) => /Confirm three companies have agreed to bid/.test(line)));
    assert.ok(kit.checklist.some((line) => /unnamed/.test(line)));
  });
});

describe("Campaign Builder copy check", () => {
  it("flags banned words, prices, guarantees, rankings and private names", () => {
    const kit = ledKit();
    kit.guard.keepPrivate = ["Acme Sound"];
    kit.emails[0].subjectA = "Free LED wall for your church";
    kit.emails[1].body += "\nWe guarantee results. AI picks the best fit. Acme Sound installs it for $9,000.";
    kit.landing.h1 = "The #1 church AV team, top-rated in Georgia";
    const problems = copyProblems(kit);
    const rules = problems.map((p) => p.rule);
    assert.ok(rules.includes('Never say "free"'));
    assert.ok(rules.includes('Never say "AI"'));
    assert.ok(rules.includes("Never promise a guarantee"));
    assert.ok(rules.includes("No ranking promises"));
    assert.ok(rules.includes("No prices or dollar amounts"));
    assert.ok(rules.includes('Keep "Acme Sound" private'));
    assert.ok(problems.some((p) => p.where === "Email 1 · subject A" && p.found === "Free"));
  });

  it("does not trip on words that only contain a banned word", () => {
    const kit = ledKit();
    kit.landing.lead = "Freedom to choose, said plainly. The air is clear.";
    assert.deepEqual(copyProblems(kit), []);
  });

  it("allows a price only when the brief itself gave one and no rule bans prices", () => {
    const cleaned = cleanBrief({
      company: "Acme Bakery",
      product: "Wedding cakes",
      audience: "couples in Savannah",
      offer: "Tastings are $25 and count toward your cake"
    });
    assert.equal(cleaned.ok, true);
    if (!cleaned.ok) return;
    const kit = buildCampaignKit(cleaned.brief);
    assert.equal(kit.guard.pricesAllowed, true);
    assert.deepEqual(copyProblems(kit), []);
    assert.ok(copyProblems(kit, ["no prices"]).some((p) => p.rule === "No prices or dollar amounts"));
  });
});

describe("Campaign Builder polish merge", () => {
  it("accepts reworded copy that keeps the shape and the rules", () => {
    const kit = ledKit();
    const copy = polishableCopy(kit);
    copy.emails[0].subjectB = "A better way to choose your church's LED wall";
    const merged = mergePolishedCopy(kit, copy);
    assert.ok(merged);
    assert.equal(merged?.generatedBy, "ai");
    assert.equal(merged?.emails[0].subjectB, "A better way to choose your church's LED wall");
    assert.equal(merged?.emails[0].ctaUrl, kit.emails[0].ctaUrl);
    assert.deepEqual(merged?.dashboard, kit.dashboard);
  });

  it("falls back on a broken shape, a lost link, a repeated subject, or a rule break", () => {
    const kit = ledKit();
    assert.equal(mergePolishedCopy(kit, null), null);
    assert.equal(mergePolishedCopy(kit, { positioning: kit.positioning }), null);

    const fewer = polishableCopy(kit);
    fewer.emails.pop();
    assert.equal(mergePolishedCopy(kit, fewer), null);

    const lostLink = polishableCopy(kit);
    lostLink.emails[1].body = "Hello, here is a much shorter note without any link at all in it.";
    assert.equal(mergePolishedCopy(kit, lostLink), null);

    const same = polishableCopy(kit);
    same.emails[2].subjectB = same.emails[2].subjectA;
    assert.equal(mergePolishedCopy(kit, same), null);

    const longMeta = polishableCopy(kit);
    longMeta.landing.metaDescription = "x ".repeat(100);
    assert.equal(mergePolishedCopy(kit, longMeta), null);

    const banned = polishableCopy(kit);
    banned.landing.h1 = "Free LED walls for your church";
    assert.equal(mergePolishedCopy(kit, banned), null);
  });
});

describe("Campaign Builder words", () => {
  it("finds the first thing named in a product", () => {
    assert.equal(productTopic("LED walls, stage lighting and sound for church sanctuaries"), "LED walls");
    assert.equal(fitSentences(["Short."], [], 20, 40).length >= 20, true);
  });
});
