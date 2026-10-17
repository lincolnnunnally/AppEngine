// Smoke: CRM v1 (/crm) — one card per org or person across ChurchConnect,
// Laser, and Presence. Runs the pure rules in src/lib/engine/lpl-crm-core.ts on
// FIXTURES (no live data, no network, no personal data), then checks the
// read-only / owner-only / privacy contracts structurally.
// Run: node scripts/smoke-lpl-crm.js
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();
let failures = 0;

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

async function runStep(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`missing ${label}: ${JSON.stringify(needle)}`);
}

async function loadCore() {
  const source = read("src/lib/engine/lpl-crm-core.ts");
  const out = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(out).toString("base64")}`);
}

const NOW = new Date("2026-10-17T14:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const daysAhead = (n) => new Date(NOW.getTime() + n * 86_400_000).toISOString();
const none = () => ({ emails: new Set(), domains: new Set(), phones: new Set() });

function node(overrides) {
  return {
    id: "x",
    app: "churchconnect",
    kind: "org",
    name: "Fixture Church",
    town: "Testville, GA",
    emails: [],
    domains: [],
    phones: [],
    links: [],
    touches: [],
    ...overrides
  };
}

const core = await loadCore();
const { buildCards, buildFollowUps, repeatRule, normDomain, normPhone, normEmail, scrubContact, shortPersonName, followThroughStep, recordLink, hasClockTime, friendlyDay } = core;

const cardFor = (cards, name) => cards.find((card) => card.name === name);

await runStep("normalizers: email, phone, website; shared hosts never prove same org", () => {
  assert(normEmail(" Pastor@Fixture.Church ") === "pastor@fixture.church", "email lowercases");
  assert(normEmail("not an email") === "", "bad email dropped");
  assert(normPhone("+1 (555) 010-0199") === "5550100199", "phone digits, US 10");
  assert(normPhone("12345") === "", "short phone dropped");
  assert(normDomain("https://www.fixture.church/about?x=1") === "fixture.church", "domain stripped");
  assert(normDomain("https://facebook.com/fixturechurch") === "", "facebook is not an org website");
  assert(normDomain("fixture.wixsite.com") === "", "site builders are shared hosts");
});

await runStep("matching order: explicit id, then email, then website, then phone", () => {
  const nodes = [
    node({ id: "cc:church:1", name: "Alpha Church", emails: ["office@alpha.church"], domains: ["alpha.church"] }),
    node({ id: "laser:place:9", app: "laser", kind: "place", name: "Alpha (catalog)", town: "Testville", links: ["cc:church:1"] }),
    node({ id: "laser:person:a", app: "laser", kind: "person", name: "Sam P.", emails: ["Office@alpha.church"] }),
    node({ id: "presence:place:3", app: "presence", kind: "place", name: "Alpha lawn", domains: ["https://alpha.church/visit"] }),
    node({ id: "cc:church:2", name: "Beta Church", phones: ["555-010-0101"] }),
    node({ id: "laser:place:8", app: "laser", kind: "place", name: "Beta shop", phones: ["(555) 010 0101"] })
  ];
  const cards = buildCards(nodes, none(), NOW);
  const alpha = cardFor(cards, "Alpha Church");
  assert(alpha, "alpha card exists, named from the church");
  assert(alpha.recordCount === 4, `alpha merges 4 records, got ${alpha.recordCount}`);
  for (const kind of ["id", "email", "domain"]) assert(alpha.matchedBy.includes(kind), `alpha matched by ${kind}`);
  assert(alpha.apps.join(",") === "churchconnect,presence,laser", `alpha apps ${alpha.apps}`);
  const beta = cardFor(cards, "Beta Church");
  assert(beta && beta.recordCount === 2 && beta.matchedBy.includes("phone"), "beta matched by phone");
  assert(cards.length === 2, `two cards, got ${cards.length}`);
});

await runStep("name + town is only a possible match, never a merge", () => {
  const cards = buildCards(
    [
      node({ id: "cc:church:5", name: "Grace Chapel", town: "Lyons, GA" }),
      node({ id: "laser:place:5", app: "laser", kind: "place", name: "Grace Chapel", town: "Lyons", touches: [{ at: daysAgo(20), app: "laser", kind: "sample", what: "Left a sample", outreach: true }] })
    ],
    none(),
    NOW
  );
  assert(cards.length === 2, "two separate cards");
  for (const card of cards) {
    assert(card.possibleMatches.length === 1, `${card.name} shows one possible match`);
    assert(card.matchedBy.length === 0, "nothing merged");
  }
});

await runStep("a key shared by many records is too generic to merge", () => {
  const nodes = Array.from({ length: 6 }, (_, i) => node({ id: `cc:church:g${i}`, name: `Church ${i}`, emails: ["info@association.org"] }));
  const cards = buildCards(nodes, none(), NOW);
  assert(cards.length === 6, `generic email kept 6 cards apart, got ${cards.length}`);
});

await runStep("card keys never carry the record id (which can hold an email)", () => {
  const cards = buildCards([node({ id: "laser:person:someone@fixture.test", app: "laser", kind: "person", name: "Someone F." })], none(), NOW);
  assert(/^c[0-9a-z]+$/.test(cards[0].key), `hashed key, got ${cards[0].key}`);
  assert(!JSON.stringify(cards).includes("@"), "no @ anywhere in the card");
});

await runStep("don't repeat: 14 days across apps, then go gently", () => {
  const touch = (n, app = "laser") => ({ at: daysAgo(n), app, kind: "sample", what: "Left a sample", outreach: true });
  assert(repeatRule([touch(5)], NOW).level === "hold", "5 days → resting");
  assert(repeatRule([touch(5)], NOW).text.startsWith("Laser reached out 5 days ago"), "names the app");
  assert(repeatRule([touch(13)], NOW).level === "hold", "13 days → resting");
  assert(repeatRule([touch(14)], NOW).level === "soon", "14 days → go gently");
  assert(repeatRule([touch(45)], NOW).level === null, "45 days → clear");
  assert(repeatRule([touch(20), touch(40, "churchconnect")], NOW).text.includes("2 touches in 60 days"), "two unanswered touches");
  assert(repeatRule([{ ...touch(3), outreach: false }], NOW).level === null, "a note is not reaching out");
  const cards = buildCards(
    [
      node({ id: "cc:church:r", name: "Rest Church", emails: ["a@rest.church"], touches: [{ at: daysAgo(30), app: "churchconnect", kind: "invite", what: "Invite sent", outreach: true }] }),
      node({ id: "laser:place:r", app: "laser", kind: "place", name: "Rest", emails: ["a@rest.church"], touches: [touch(2)] })
    ],
    none(),
    NOW
  );
  assert(cards[0].repeat.level === "hold" && cards[0].lastOutreach.app === "laser", "cross-app: the newest reach-out wins");
});

await runStep("hard stops: do-not-contact, already a customer, said no", () => {
  const suppress = { emails: new Set(["no@stop.church"]), domains: new Set(["quiet.org"]), phones: new Set(["5550100000"]) };
  const cards = buildCards(
    [
      node({ id: "cc:church:s1", name: "Stop One", emails: ["NO@stop.church"] }),
      node({ id: "cc:church:s2", name: "Stop Two", domains: ["https://quiet.org"] }),
      node({ id: "cc:church:s3", name: "Stop Three", phones: ["555 010 0000"] }),
      node({ id: "cc:church:s4", name: "Customer", customerOf: ["churchconnect"] }),
      node({ id: "cc:church:s5", name: "Declined", declined: "Marked lost in the ChurchConnect pipeline. Do not pitch again." }),
      node({ id: "cc:church:s6", name: "Fine" })
    ],
    suppress,
    NOW
  );
  for (const name of ["Stop One", "Stop Two", "Stop Three"]) assert(cardFor(cards, name).stops[0]?.reason === "suppressed", `${name} suppressed`);
  assert(cardFor(cards, "Customer").stops[0].reason === "customer", "customer stop");
  assert(cardFor(cards, "Customer").stops[0].text.includes("Do not pitch ChurchConnect again"), "customer stop names the offer");
  assert(cardFor(cards, "Declined").stops[0].reason === "declined", "declined stop");
  assert(cardFor(cards, "Fine").stops.length === 0, "no stop");
});

const NO_SUPPRESS = { emails: new Set(), domains: new Set(), phones: new Set() };
const TODAY = "2026-10-17";
const out = (n) => ({ at: daysAgo(n), app: "churchconnect", kind: "invite", what: "Invite sent", outreach: true });
const heard = (n) => ({ at: daysAgo(n), app: "churchconnect", kind: "view", what: "Website preview page opened", outreach: false, signal: true });
const rowFor = (rows, name) => rows.find((row) => row.name === name);
const HELD = ["due", "warm", "unpaid"];

await runStep("rest vs due: they replied after our last reach-out → rest lifted, due stays due", () => {
  const cards = buildCards([node({ id: "cc:church:r1", name: "Replied Church", nextActionDate: TODAY, nextAction: "Call about the website preview", touches: [heard(2), out(9)] })], NO_SUPPRESS, NOW);
  const rows = buildFollowUps(cards, NOW);
  const card = cards[0];
  assert(card.repeat.level === "replied", `level ${card.repeat.level}`);
  assert(card.repeat.text === "They replied Oct 15 — OK to follow up.", card.repeat.text);
  assert(card.nextActionDate === TODAY && !card.nextActionMovedFrom, "due date untouched");
  assert(rowFor(rows, "Replied Church").reasons.includes("due"), "still due today");
});

await runStep("rest vs due: still resting → due date moves to the rest end, out of Due today", () => {
  const cards = buildCards([node({ id: "cc:church:r2", name: "Resting Church", nextActionDate: TODAY, nextAction: "Send the follow-up", touches: [out(5)] })], NO_SUPPRESS, NOW);
  const rows = buildFollowUps(cards, NOW);
  const card = cards[0];
  assert(card.repeat.level === "hold", "resting");
  assert(card.nextActionDate === "2026-10-26" && card.nextActionMovedFrom === TODAY, `moved to ${card.nextActionDate}`);
  const row = rowFor(rows, "Resting Church");
  assert(row && !row.today && row.reasons.join() === "wait", `wait only, got ${row && row.reasons}`);
  assert(row.items[0].why.startsWith("Resting until Oct 26."), row.items[0].why);
  assert(row.nextStep === "Wait until Oct 26. Then follow up through ChurchConnect only.", row.nextStep);
});

await runStep("rest vs due: a hard stop wins over rest, reply, and due", () => {
  const cards = buildCards(
    [
      node({ id: "cc:church:r3", name: "Said No", declined: "Marked lost. Do not pitch again.", nextActionDate: TODAY, touches: [out(5)] }),
      node({ id: "cc:church:r4", name: "Do Not Contact", emails: ["x@dnc.church"], nextActionDate: TODAY, touches: [heard(1), out(4)] })
    ],
    { emails: new Set(["x@dnc.church"]), domains: new Set(), phones: new Set() },
    NOW
  );
  const rows = buildFollowUps(cards, NOW);
  for (const card of cards) {
    assert(card.repeat.level === null, `${card.name}: no rest/reply banner beside a stop`);
    assert(!rowFor(rows, card.name), `${card.name}: not on the follow-up list`);
    assert(card.nextStep === "", `${card.name}: no next step`);
  }
});

await runStep("outreach rows for resting orgs are held (wait); events and token prep stay", () => {
  const cards = buildCards(
    [
      node({ id: "cc:church:w1", name: "Hold And Prep", touches: [out(5)], tokens: [{ label: "T1", status: "approved", printed: false }], events: [{ title: "Picnic", startsAt: daysAhead(4), status: "open", place: "Lawn" }] }),
      node({ id: "laser:person:w2", app: "laser", kind: "person", name: "Owes Money", touches: [{ at: daysAgo(6), app: "laser", kind: "sample", what: "Left a sample", outreach: true }, { at: daysAgo(10), app: "laser", kind: "order", what: "Order placed", outreach: false, signal: true, purchase: "$20.00 not paid", unpaid: true }] })
    ],
    NO_SUPPRESS,
    NOW
  );
  const rows = buildFollowUps(cards, NOW);
  const prep = rowFor(rows, "Hold And Prep");
  assert(prep.today && prep.reasons.join() === "events,tokens,wait", `prep stays today, got ${prep.reasons}`);
  const owes = rowFor(rows, "Owes Money");
  assert(!owes.today && owes.reasons.join() === "wait", `unpaid held while resting, got ${owes.reasons}`);
  assert(owes.items[0].why.includes("Held: not paid yet."), owes.items[0].why);
  for (const card of cards) {
    if (card.repeat.level !== "hold") continue;
    const row = rowFor(rows, card.name);
    assert(!row || !row.reasons.some((reason) => HELD.includes(reason)), `${card.name}: resting AND an outreach reason`);
  }
});

await runStep("follow-ups: one row per org, reasons stacked, one next step for list and card", () => {
  const cards = buildCards(
    [
      node({ id: "cc:church:d", name: "Due Church", nextActionDate: "2026-10-16", nextAction: "Call back" }),
      node({ id: "cc:church:h", name: "Warm Church", touches: [heard(1), { ...out(20), app: "churchconnect", kind: "site_offer", what: "Website offer sent" }] }),
      node({ id: "laser:person:u", app: "laser", kind: "person", name: "Pat Q.", touches: [{ at: daysAgo(5), app: "laser", kind: "order", what: "Order 1001", outreach: false, signal: true, purchase: "$24.00 not paid", unpaid: true }] }),
      node({ id: "presence:batch:t", app: "presence", kind: "batch", name: "Token batch: Fall", tokens: [{ label: "Fall #1", status: "approved", printed: false }, { label: "Fall #2", status: "engraved", printed: true }], events: [{ title: "Sunset walk", startsAt: daysAhead(5), status: "open", place: "Riverfront" }] })
    ],
    NO_SUPPRESS,
    NOW
  );
  const rows = buildFollowUps(cards, NOW);
  assert(rows.length === 4 && new Set(rows.map((row) => row.cardKey)).size === 4, "one row per card");
  const pat = rowFor(rows, "Pat Q.");
  assert(pat.reasons.join() === "unpaid,warm", `Pat stacked reasons ${pat.reasons}`);
  assert(pat.nextStep === "Confirm the order and how they will pay.", pat.nextStep);
  const batch = rowFor(rows, "Token batch: Fall");
  assert(batch.reasons.join() === "events,tokens", `batch ${batch.reasons}`);
  assert(batch.items.find((item) => item.reason === "tokens").why.startsWith("1 token"), "counts only unprinted tokens");
  assert(rowFor(rows, "Due Church").items[0].why === "Next step was due Oct 16.", "plain date");
  assert(rows[0].reasons[0] === "due", "due first");
  for (const row of rows) {
    const card = cards.find((item) => item.key === row.cardKey);
    assert(card.nextStep === row.nextStep, `${row.name}: card says "${card.nextStep}", list says "${row.nextStep}"`);
    assert(card.followUpReasons.join() === row.reasons.join(), `${row.name}: reasons agree`);
  }
});

await runStep("wording: follow up through one app so the other doesn't also reach out", () => {
  const cards = buildCards(
    [
      node({ id: "cc:church:f1", name: "Two Apps", emails: ["a@two.church"], touches: [out(20)] }),
      node({ id: "laser:place:f1", app: "laser", kind: "place", name: "Two Apps", emails: ["a@two.church"] })
    ],
    NO_SUPPRESS,
    NOW
  );
  assert(followThroughStep(cards[0]) === "Follow up through ChurchConnect only, so Laser doesn't also reach out.", followThroughStep(cards[0]));
  const src = read("src/lib/engine/lpl-crm-core.ts");
  assert(!src.includes("No second app yet"), "old wording gone");
});

await runStep("Open in <app>: exact record where the app supports it, admin home otherwise", () => {
  const id = "0b9f6a1e-3c2d-4e5f-8a7b-6c5d4e3f2a1b";
  const cards = buildCards(
    [
      node({ id: `cc:church:${id}`, name: "Linked", emails: ["a@linked.church"], recordPath: `#crm/lead/${id}` }),
      node({ id: "laser:person:x", app: "laser", kind: "person", name: "L", emails: ["a@linked.church"], recordPath: "#person/a@linked.church" })
    ],
    NO_SUPPRESS,
    NOW
  );
  const card = cards[0];
  const urls = { churchconnect: "https://cc.example/admin", laser: "https://laser.example/admin" };
  const cc = recordLink("churchconnect", card, urls);
  assert(cc.exact && cc.href === `https://cc.example/admin#crm/lead/${id}`, cc.href);
  const laser = recordLink("laser", card, urls);
  assert(!laser.exact && laser.href === "https://laser.example/admin", "record path with contact details is refused");
  assert(recordLink("presence", card, urls) === null, "no admin URL → no button");
  const reader = read("src/lib/engine/lpl-crm.ts");
  assertIncludes(reader, "recordPath: UUID_RE.test(id) ? `#crm/lead/${id}` : undefined", "ChurchConnect deep link from the church id");
  const desk = read("src/components/engine/crm-desk.tsx");
  assertIncludes(desk, "recordLink(app, card, adminUrls)", "buttons use recordLink");
  assertIncludes(desk, "has no page for a single record yet", "honest label when no record page exists");
  assertIncludes(desk, "onClick={() => onOpen(match.key!)}", "See that card focuses the card even when it is filtered out");
  assertIncludes(desk, "onClick={() => onOpen(row.cardKey)}", "Open card focuses the card");
  assertIncludes(read("src/app/(cockpit)/crm/page.tsx"), "Where this comes from", "sources panel");
});

await runStep("times: real clock times shown, plain dates stay dates; current year dropped", () => {
  assert(hasClockTime("2026-10-08T14:32:10.123Z"), "real moment");
  assert(hasClockTime("2026-10-08T09:15:00-04:00"), "offset moment");
  assert(!hasClockTime("2026-10-08"), "plain day");
  assert(!hasClockTime("2026-10-08T00:00:00Z") && !hasClockTime("2026-10-08T00:00:00+00:00"), "midnight UTC is a typed date");
  const desk = read("src/components/engine/crm-desk.tsx");
  assertIncludes(desk, "yearFmt.format(date) === yearFmt.format(new Date())", "drop the year in the current year");
  assert(friendlyDay("2026-10-08") === "Oct 8", friendlyDay("2026-10-08"));
});

await runStep("card chips: 'Not reached out yet' uses the card's own test; no duplicate of Everyone", () => {
  const desk = read("src/components/engine/crm-desk.tsx");
  assertIncludes(desk, "return !card.lastOutreach;", "quiet = no reach-out, same as 'Not yet'");
  assert(!desk.includes("Reached or active"), "redundant chip removed");
  assertIncludes(desk, 'today: "On today\'s list"', "today chip");
  assertIncludes(read("src/app/(cockpit)/crm/page.tsx"), "of {snapshot.presence.tokens} token", "'1 of 5 tokens printed' caption");
  assertIncludes(desk, "Timeline ({card.touches.length})", "short Timeline toggle");
  assertIncludes(desk, "What the words mean", "legend");
});

await runStep("readability and tap targets: labels ≥14px, body 16px, controls ≥44px", () => {
  const css = read("src/app/styles.css");
  const block = css.slice(css.indexOf("/* CRM v1 — readability + tap targets"));
  for (const sel of [".crm-page .dx-label", ".crm-page .dx-stat span", ".crm-page .crm-follow-tag", ".crm-page .crm-facts dt"]) assertIncludes(block, sel, sel);
  assertIncludes(block, "font-size: 0.875rem; letter-spacing", "mono labels 14px");
  assertIncludes(block, ".crm-page .crm-chip { font-size: 1rem; min-height: 44px;", "chips 44px");
  assertIncludes(block, ".crm-page .crm-more summary { min-height: 44px; }", "timeline toggle 44px");
  assertIncludes(block, "min-height: 44px; font-size: 0.875rem; padding: 8px 14px;", "Open card / Open in buttons 44px");
});

await runStep("privacy helpers: first name + initial, contact details scrubbed", () => {
  assert(shortPersonName("Mary Ellen Smith") === "Mary S.", "short name");
  assert(shortPersonName("") === "", "empty");
  const text = scrubContact("Invite sent to pastor@fixture.church or 555-010-0199 today");
  assert(!text.includes("@") && !/\d{3}-\d{3}-\d{4}/.test(text), `scrubbed: ${text}`);
});

await runStep("reader is read-only, server-only, and never logs rows", () => {
  const reader = read("src/lib/engine/lpl-crm.ts");
  assertIncludes(reader, 'method: "GET"', "GET only");
  for (const banned of ['method: "POST"', 'method: "PATCH"', 'method: "PUT"', 'method: "DELETE"', "console.log", "console.error", "console.warn", "prefer: \"return="]) {
    assert(!reader.includes(banned), `reader must not contain ${banned}`);
  }
  assertIncludes(reader, "SUPABASE_SERVICE_ROLE_KEY", "same key source as lpl-ops-stats");
  assertIncludes(reader.replace(/\n\/\/ /g, " "), "No new tables, no writes, nothing sent", "contract comment");
  const desk = read("src/components/engine/crm-desk.tsx");
  assertIncludes(desk, '"use client"', "client component");
  assert(!desk.includes("lpl-crm\"") && !desk.includes("SERVICE_ROLE") && !desk.includes("process.env"), "client never touches the reader or env");
});

await runStep("page is owner-only and lives in the existing desk", () => {
  const page = read("src/app/(cockpit)/crm/page.tsx");
  assertIncludes(page, "canAccessEngineAdmin", "desk auth gate");
  assertIncludes(page, 'redirect("/")', "non-owners leave");
  assertIncludes(read("src/app/(cockpit)/layout.tsx"), "canAccessEngineAdmin", "cockpit layout gate");
  assertIncludes(read("src/components/engine/app-shell.tsx"), '{ label: "People & places", href: "/crm" }', "rail link");
  assertIncludes(read("src/components/engine/owner-command-deck.tsx"), 'href="/crm"', "owner deck link");
  assertIncludes(read("source-of-truth/super-admin-registry.md"), "### People & places (CRM v1", "registry entry");
});

await runStep("plain words on screen — no vendor names", () => {
  const screens = read("src/app/(cockpit)/crm/page.tsx") + read("src/components/engine/crm-desk.tsx");
  const visible = screens.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/import[^;]+;/g, "");
  for (const vendor of ["Supabase", "supabase", "Vercel", "Stripe", "Resend", "Neon", "PostgREST", "jsonb"]) {
    assert(!visible.includes(vendor), `vendor word on screen: ${vendor}`);
  }
});

if (failures) {
  console.error(`\n${failures} CRM smoke step(s) failed.`);
  process.exit(1);
}
console.log("\nCRM v1 smoke passed.");
