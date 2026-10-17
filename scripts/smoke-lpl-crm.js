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
const { buildCards, buildFollowUps, repeatRule, normDomain, normPhone, normEmail, scrubContact, shortPersonName } = core;

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

await runStep("daily follow-ups: due, waiting, warm, unpaid, tokens, events", () => {
  const cards = buildCards(
    [
      node({ id: "cc:church:d", name: "Due Church", nextActionDate: "2026-10-16", nextAction: "Call back" }),
      node({ id: "cc:church:w", name: "Waiting Church", touches: [{ at: daysAgo(6), app: "churchconnect", kind: "invite", what: "Invite sent", outreach: true }] }),
      node({ id: "cc:church:r", name: "Replied Church", touches: [
        { at: daysAgo(6), app: "churchconnect", kind: "invite", what: "Invite sent", outreach: true },
        { at: daysAgo(4), app: "churchconnect", kind: "invite", what: "Accepted the invite", outreach: false, signal: true }
      ] }),
      node({ id: "cc:church:h", name: "Warm Church", touches: [
        { at: daysAgo(20), app: "churchconnect", kind: "site_offer", what: "Website offer sent", outreach: true },
        { at: daysAgo(1), app: "churchconnect", kind: "view", what: "Website preview page opened", outreach: false, signal: true }
      ] }),
      node({ id: "laser:person:u", app: "laser", kind: "person", name: "Pat Q.", touches: [{ at: daysAgo(5), app: "laser", kind: "order", what: "Order 1001", outreach: false, signal: true, purchase: "$24.00 not paid", unpaid: true }] }),
      node({ id: "presence:batch:t", app: "presence", kind: "batch", name: "Token batch: Fall", tokens: [
        { label: "Fall #1", status: "approved", printed: false },
        { label: "Fall #2", status: "engraved", printed: true }
      ], events: [{ title: "Sunset walk", startsAt: daysAhead(5), status: "open", place: "Riverfront" }] }),
      node({ id: "cc:church:x", name: "Suppressed Church", emails: ["x@sup.church"], touches: [{ at: daysAgo(6), app: "churchconnect", kind: "invite", what: "Invite sent", outreach: true }] })
    ],
    { emails: new Set(["x@sup.church"]), domains: new Set(), phones: new Set() },
    NOW
  );
  const list = buildFollowUps(cards, NOW);
  const has = (reason, name) => list.some((item) => item.reason === reason && item.name === name);
  assert(has("due", "Due Church"), "due today");
  assert(has("waiting", "Waiting Church"), "waiting 3–14 days");
  assert(!has("waiting", "Replied Church"), "a reply ends waiting");
  assert(has("warm", "Warm Church"), "warm signal with no follow-up");
  assert(has("unpaid", "Pat Q."), "unpaid order");
  assert(has("tokens", "Token batch: Fall"), "tokens to print");
  assert(list.find((item) => item.reason === "tokens").why.startsWith("1 token"), "counts only unprinted tokens");
  assert(has("events", "Token batch: Fall"), "upcoming event");
  assert(!list.some((item) => item.name === "Suppressed Church" && (item.reason === "waiting" || item.reason === "warm")), "suppressed is never chased");
  assert(list[0].reason === "due", "due comes first");
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
