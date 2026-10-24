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
const { buildCards, buildFollowUps, repeatRule, normDomain, normPhone, normEmail, scrubContact, shortPersonName, followThroughStep, recordLink, hasClockTime, friendlyDay, dedupeLines, adminHomeNote, countTokens, dedupeTouches, dayOf } = core;

const cardFor = (cards, name) => cards.find((card) => card.name === name);

await runStep("normalizers: email, phone, website; shared hosts never prove same org", () => {
  assert(normEmail(" Pastor@Fixture.Church ") === "pastor@fixture.church", "email lowercases");
  assert(normEmail("not an email") === "", "bad email dropped");
  assert(normPhone("+1 (555) 010-0199") === "5550100199", "phone digits, US 10");
  assert(normPhone("12345") === "", "short phone dropped");
  assert(normPhone("404 555 0143 x12") === "4045550143" && normPhone("(404) 555-0143 ext. 12") === "4045550143" && normPhone("4045550143x12") === "4045550143" && normPhone("404-555-0143 #12") === "4045550143", "phone extension is stripped before the digits");
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

await runStep("a row never repeats the same line twice (shorter duplicate dropped)", () => {
  const cards = buildCards(
    [node({ id: "laser:person:dup", app: "laser", kind: "person", name: "Dana R.", touches: [{ at: daysAgo(5), app: "laser", kind: "order", what: "Order placed", outreach: false, signal: true, purchase: "$38.00 not paid", unpaid: true }] })],
    NO_SUPPRESS,
    NOW
  );
  const row = rowFor(buildFollowUps(cards, NOW), "Dana R.");
  assert(row.reasons.join() === "unpaid,warm", `both reasons kept, got ${row.reasons}`);
  assert(row.items.length === 1, `one line, got ${row.items.map((item) => item.why).join(" | ")}`);
  assert(row.items[0].why.startsWith("Laser: Order placed ($38.00 not paid), placed"), row.items[0].why);
  const kept = dedupeLines([
    { reason: "warm", why: "Laser: Order placed.", step: "a" },
    { reason: "unpaid", why: "Laser: Order placed ($38.00 not paid), placed Oct 12.", step: "b" },
    { reason: "tokens", why: "2 tokens not printed yet.", step: "c" },
    { reason: "events", why: "2 tokens not printed yet.", step: "d" }
  ]);
  assert(kept.map((item) => item.reason).join() === "unpaid,tokens", `kept ${kept.map((item) => item.reason)}`);
});

await runStep("admin-home notes: ChurchConnect says not linked; Laser and Presence say no record page", () => {
  assert(adminHomeNote("churchconnect") === "Not linked to a ChurchConnect church yet, so this opens the admin home.", adminHomeNote("churchconnect"));
  assert(adminHomeNote("laser") === "Laser has no page for a single record yet, so this opens the admin home.", adminHomeNote("laser"));
  assert(adminHomeNote("presence") === "Presence has no page for a single record yet, so this opens the admin home.", adminHomeNote("presence"));
  assertIncludes(read("src/components/engine/crm-desk.tsx"), "{adminHomeNote(app)}", "desk uses the shared note");
});

await runStep("fail closed: unreadable do-not-contact list → no outreach suggested, prep stays", () => {
  const cards = buildCards(
    [
      node({ id: "cc:church:fc1", name: "Due Here", nextActionDate: TODAY, nextAction: "Call", touches: [heard(1), out(20)] }),
      node({ id: "cc:church:fc2", name: "Resting Here", touches: [out(5)] }),
      node({ id: "presence:batch:fc3", app: "presence", kind: "batch", name: "Prep Batch", tokens: [{ label: "T", status: "approved", printed: false }], events: [{ title: "Walk", startsAt: daysAhead(3), status: "open", place: "Park" }] })
    ],
    NO_SUPPRESS,
    NOW
  );
  const rows = buildFollowUps(cards, NOW, { outreachHidden: true });
  assert(!rows.some((row) => row.reasons.some((reason) => ["due", "warm", "unpaid", "wait"].includes(reason))), `outreach leaked: ${rows.map((row) => row.name + ":" + row.reasons).join(" ")}`);
  assert(rowFor(rows, "Prep Batch").reasons.join() === "events,tokens", "prep stays");
  assert(rows.every((row) => row.nextStep === ""), "no next step while the list is unreadable");
  const reader = read("src/lib/engine/lpl-crm.ts");
  assertIncludes(reader, 'source.id === "outreach_suppressions" && !source.ok', "reader detects an unreadable list");
  assertIncludes(reader, "buildFollowUps(cards, now, { outreachHidden: suppressionsUnreadable })", "reader fails closed");
  assertIncludes(read("src/app/(cockpit)/crm/page.tsx"), "The do-not-contact list could not be read", "page says why");
});

await runStep("same record from two rows keeps every identity key (phone on the order still suppresses)", () => {
  const reader = read("src/lib/engine/lpl-crm.ts");
  assertIncludes(reader, 'for (const key of ["emails", "domains", "phones", "links"] as const)', "coalesce merges identity keys");
  // Behaviour: a card whose phone is on the do-not-contact list stops, whichever row carried it.
  const merged = node({ id: "laser:person:p", app: "laser", kind: "person", name: "P", emails: ["p@x.test"], phones: ["555-010-0177"], touches: [out(20)] });
  const cards = buildCards([merged], { emails: new Set(), domains: new Set(), phones: new Set(["5550100177"]) }, NOW);
  assert(cards[0].stops[0]?.reason === "suppressed", "phone suppression applies");
});

await runStep("tokens: a planned batch of 100 counts as 100", () => {
  const tokens = [{ label: "100 tokens planned", status: "draft", printed: false, count: 100 }, { label: "A", status: "engraved", printed: true }, { label: "R", status: "retired", printed: null }];
  assert(countTokens(tokens) === 101 && countTokens(tokens, false) === 100 && countTokens(tokens, true) === 1, "weighted counts");
  const cards = buildCards([node({ id: "presence:batch:q", app: "presence", kind: "batch", name: "Big Batch", tokens })], NO_SUPPRESS, NOW);
  assert(rowFor(buildFollowUps(cards, NOW), "Big Batch").items[0].why === "100 tokens not printed yet.", "follow-up uses the weighted count");
  const reader = read("src/lib/engine/lpl-crm.ts");
  assertIncludes(reader, "count: Math.max(1, Number.parseInt(s(batch.quantity), 10) || 1)", "batch quantity carried");
  assertIncludes(reader, "events: looseMoments.filter((moment) => s(moment.coin_batch_id) === id).map(eventRow)", "events stay with an empty batch");
  assertIncludes(reader, "doc->>domain.ilike.", "directory lookup searches the domain field too");
});

await runStep("one send from two sources is one touch; ISO due dates compare in Eastern time", () => {
  const a = { at: "2026-10-12T14:00:00Z", app: "churchconnect", kind: "invite", what: "Invite sent", outreach: true };
  const b = { at: "2026-10-12T14:03:00Z", app: "churchconnect", kind: "invite", what: "Invite sent (fall)", outreach: true, response: "Accepted the invite" };
  const kept = dedupeTouches([b, a]);
  assert(kept.length === 1 && kept[0].response === "Accepted the invite", "deduped, response kept");
  assert(dedupeTouches([a, { ...a, at: "2026-10-12T15:00:00Z" }]).length === 2, "an hour apart is two sends");
  assert(dayOf("2026-10-18T00:00:00Z") === "2026-10-17", `ET day ${dayOf("2026-10-18T00:00:00Z")}`);
  assert(dayOf("2026-10-18") === "2026-10-18", "plain day unchanged");
  const cards = buildCards([node({ id: "cc:church:iso", name: "ISO Due", nextActionDate: "2026-10-18T00:00:00Z", nextAction: "Call" })], NO_SUPPRESS, NOW);
  assert(rowFor(buildFollowUps(cards, NOW), "ISO Due").reasons.includes("due"), "midnight UTC Oct 18 is due on Oct 17 ET");
});

await runStep("owner deck never waits on the full CRM read", () => {
  const reader = read("src/lib/engine/lpl-crm.ts");
  assertIncludes(reader, "const DECK_COUNT_BUDGET_MS = 2_500;", "time budget");
  assertIncludes(reader, "const DECK_COUNT_TTL_MS = 5 * 60_000;", "short cache");
  assertIncludes(read("src/app/(cockpit)/crm/page.tsx"), "rememberCrmFollowUpCount(snapshot)", "page shares its count");
});

await runStep("registry entry carries release, deployment, health and logs fields", () => {
  const reg = read("source-of-truth/super-admin-registry.md");
  const entry = reg.slice(reg.indexOf("### People & places (CRM v1"), reg.indexOf("### Testimony doors"));
  for (const field of ['"release"', '"gateStatus": "owner_approved"', '"deployment"', '"healthUrl"', '"logsUrl": "planned"', '"superAdminActions"']) assertIncludes(entry, field, field);
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
      node({ id: `cc:church:${id}`, name: "Linked", emails: ["a@linked.church"], recordPath: `/super-admin#crm/lead/${id}` }),
      node({ id: "laser:person:x", app: "laser", kind: "person", name: "L", emails: ["a@linked.church"], recordPath: "#person/a@linked.church" })
    ],
    NO_SUPPRESS,
    NOW
  );
  const card = cards[0];
  const urls = { churchconnect: "https://cc.example/admin", laser: "https://laser.example/admin" };
  const cc = recordLink("churchconnect", card, urls);
  assert(cc.exact && cc.href === `https://cc.example/super-admin#crm/lead/${id}`, cc.href);
  const viaDoor = recordLink("churchconnect", card, { churchconnect: "/api/admin/door/churchconnect" });
  assert(!viaDoor.exact && viaDoor.href === "/api/admin/door/churchconnect", "relative door: no origin to join, open the door");
  const laser = recordLink("laser", card, urls);
  assert(!laser.exact && laser.href === "https://laser.example/admin", "record path with contact details is refused");
  assert(recordLink("presence", card, urls) === null, "no admin URL → no button");
  const reader = read("src/lib/engine/lpl-crm.ts");
  assertIncludes(reader, "recordPath: UUID_RE.test(id) ? `/super-admin#crm/lead/${id}` : undefined", "ChurchConnect deep link from the church id (/super-admin, not /admin)");
  const desk = read("src/components/engine/crm-desk.tsx");
  assertIncludes(desk, "recordLink(app, card, adminUrls)", "buttons use recordLink");
  assertIncludes(desk, "adminHomeNote(app)", "honest label when no record page exists");
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
  assertIncludes(desk, "return !card.lastOutreach && !card.existingAvlTalks;", "quiet = no reach-out, and not already in existing talks");
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
  assertIncludes(css, '.crm-legend summary::before { content: "▸";', "legend toggle has the Timeline chevron");
  assertIncludes(css, ".crm-legend[open] summary::before { transform: rotate(90deg); }", "legend chevron turns when open");
  assertIncludes(block, "min-height: 44px; font-size: 0.875rem; padding: 8px 14px;", "Open card / Open in buttons 44px");
  const v2 = css.slice(css.indexOf("/* CRM v2 slice 1"));
  assertIncludes(v2, ".crm-field input, .crm-page .crm-field select { min-height: 44px; font-size: 1rem;", "form fields 44px, 16px");
  assertIncludes(v2, ".crm-field legend { font-size: 0.875rem;", "form labels 14px");
  assertIncludes(v2, ".crm-contact-link { display: inline-flex; align-items: center; min-height: 44px;", "call/email links 44px");
  assertIncludes(v2, ".crm-church-tools .dx-btn { min-height: 44px; font-size: 1rem;", "save buttons 44px");
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
  assertIncludes(page, "canAccessEngineOwner", "desk auth gate");
  assert(!page.includes("canAccessEngineAdmin"), "admins do not open the church list");
  assertIncludes(page, 'redirect("/")', "non-owners leave");
  assertIncludes(read("src/app/(cockpit)/crm/church/[id]/page.tsx"), "canAccessEngineOwner", "church detail auth gate");
  assertIncludes(read("src/app/(cockpit)/layout.tsx"), "canAccessEngineAdmin", "cockpit layout gate");
  assertIncludes(read("src/components/engine/app-shell.tsx"), '{ label: "People & places", href: "/crm" }', "rail link");
  assertIncludes(read("src/components/engine/owner-command-deck.tsx"), 'href="/crm"', "owner deck link");
  assertIncludes(read("source-of-truth/super-admin-registry.md"), "### People & places (CRM v1", "registry entry");
});

await runStep("rest: a visit rests 14 days, a drop-off 7, the longest rest wins", () => {
  const { restDaysOf, VISIT_REST_DAYS, DROP_OFF_REST_DAYS } = core;
  assert(VISIT_REST_DAYS === 14 && DROP_OFF_REST_DAYS === 7, "14 and 7");
  assert(restDaysOf({}) === 14 && restDaysOf({ restDays: 7 }) === 7 && restDaysOf({ restDays: 0 }) === 14, "default 14");
  const visit = (n) => ({ at: daysAgo(n), app: "churchconnect", kind: "visit", what: "Visit", outreach: true, restDays: 14 });
  const drop = (n) => ({ at: daysAgo(n), app: "churchconnect", kind: "drop_off", what: "Drop-off", outreach: true, restDays: 7 });
  assert(repeatRule([visit(10)], NOW).level === "hold", "visit 10 days ago → resting");
  assert(repeatRule([visit(10)], NOW).text.startsWith("You visited 10 days ago."), repeatRule([visit(10)], NOW).text);
  assert(repeatRule([drop(6)], NOW).level === "hold", "drop-off 6 days ago → resting");
  assert(repeatRule([drop(6)], NOW).text.startsWith("You dropped off something 6 days ago."), repeatRule([drop(6)], NOW).text);
  assert(repeatRule([{ ...drop(2), left: "a gift box" }], NOW).text.startsWith("You dropped off a gift box 2 days ago."), "names what was left");
  assert(!repeatRule([visit(10)], NOW).text.includes("ChurchConnect visited"), "in person it was you");
  assert(repeatRule([{ at: daysAgo(3), app: "laser", kind: "sample", what: "Left a sample", outreach: true, restDays: 7 }], NOW).text.startsWith("Laser reached out 3 days ago."), "apps still named for their own touches");
  assert(repeatRule([drop(8)], NOW).level === "soon", "drop-off 8 days ago → go gently");
  // VAD slice 4 r1: Go gently after an in-person visit says "You visited", like the rest banner; drop-off and app wording unchanged.
  assert(repeatRule([visit(20)], NOW).text === "You visited 20 days ago. Fine to follow up, but go gently.", repeatRule([visit(20)], NOW).text);
  assert(repeatRule([drop(8)], NOW).text === "You dropped something off 8 days ago. Fine to follow up, but go gently.", repeatRule([drop(8)], NOW).text);
  assert(repeatRule([{ at: daysAgo(20), app: "churchconnect", kind: "invite", what: "Invite", outreach: true }], NOW).text === "ChurchConnect reached out 20 days ago. Fine to follow up, but go gently.", "an app's own reach-out is still named by the app");
  // A drop-off yesterday after a visit 3 days ago: the visit's rest ends later and wins.
  const both = repeatRule([drop(1), visit(3)], NOW);
  assert(both.level === "hold" && both.until.slice(0, 10) === daysAgo(3 - 14).slice(0, 10), `longest rest wins, got ${both.until}`);
  // VAD: the newest time there was a drop-off, so the line says when you were last there, not "You visited".
  assert(both.text.startsWith("You were last there yesterday.") && !both.text.includes("You visited"), both.text);
  const dropToday = repeatRule([drop(0), visit(5)], NOW);
  assert(dropToday.text.startsWith("You were last there today.") && dropToday.until.slice(0, 10) === daysAgo(5 - 14).slice(0, 10), `drop-off today after a visit: ${dropToday.text}`);
  assert(repeatRule([visit(1), drop(3)], NOW).text.startsWith("You visited yesterday."), "a visit that is the newest still says You visited");
  // A typed day counts calendar days in Eastern time.
  const typed = repeatRule([{ at: "2026-10-14T16:00:00.000Z", dateOnly: true, app: "churchconnect", kind: "visit", what: "Visit", outreach: true, restDays: 14 }], new Date("2026-10-17T13:00:00Z"));
  assert(typed.text.includes("You visited 3 days ago"), typed.text);
  // Laser samples are drop-offs too when the reader marks them.
  assert(repeatRule([{ at: daysAgo(8), app: "laser", kind: "sample", what: "Left a sample", outreach: true, restDays: 7 }], NOW).level === "soon", "sample rests 7");
  const reader = read("src/lib/engine/lpl-crm.ts");
  assertIncludes(reader, 'kind: "sample", what, outreach: true, restDays: DROP_OFF_REST_DAYS', "Laser samples rest 7");
  assertIncludes(reader, 'restDays: type === "drop_off" ? DROP_OFF_REST_DAYS : VISIT_REST_DAYS', "visit 14 / drop-off 7");
});

await runStep("church contacts: one list per card, details only for the owner", () => {
  const { contactsForViewer } = core;
  const cards = buildCards(
    [
      node({ id: "cc:church:11111111-1111-4111-8111-111111111111", churchId: "11111111-1111-4111-8111-111111111111", name: "Contact Church", contacts: [
        { id: "sc-aaaaaaaaaaaa", name: "Mary Smith", title: "Secretary", email: "mary@contact.church", phone: "555-111-2222", source: "saved" },
        { id: "cc-pastor-1", name: "Pat Jones", title: "Pastor", email: "", phone: "", source: "pastor" },
        { id: "cc-contact-1", name: "Mary Smith", title: "", email: "mary@contact.church", phone: "555-111-2222", source: "contact" }
      ] })
    ],
    NO_SUPPRESS,
    NOW
  );
  const card = cards[0];
  assert(card.churchId === "11111111-1111-4111-8111-111111111111", "card knows its church");
  assert(card.contacts.length === 2 && card.contacts[0].source === "saved", `deduped, saved first: ${JSON.stringify(card.contacts.map((c) => c.name))}`);
  const admin = contactsForViewer(card.contacts, false);
  assert(admin.every((c) => c.email === "" && c.phone === ""), "admins never get email or phone");
  assert(admin[0].name === "Mary Smith" && admin[0].title === "Secretary", "admins keep name and title");
  assert(contactsForViewer(card.contacts, true)[0].email === "mary@contact.church", "owner sees details");
  const page = read("src/app/(cockpit)/crm/page.tsx");
  assertIncludes(page, "contactsForViewer(card.contacts, isOwner)", "page strips details for non-owners");
  assertIncludes(page, "cards={viewCards}", "stripped cards reach the browser");
  assertIncludes(page, "const canSave = isOwner && (await crmSavingConfigured())", "only the owner gets save forms");
  assertIncludes(page, "const savingOff = isOwner && !canSave ? savingOffNote() : \"\"", "owner-only note when saving is off");
  assertIncludes(read("src/lib/engine/lpl-crm-write.ts"), 'return `${savingOffMessage(env)} You can look, but orgs, visits, and contacts can\'t be saved from here.`;', "the preview note keeps a space after the period");
});

await runStep("saving: owner-only server actions, narrow pass, one save per form", () => {
  const actions = read("src/app/(cockpit)/crm/actions.ts");
  assert(actions.startsWith('"use server"'), "server actions file");
  const gates = actions.match(/if \(!\(await canAccessEngineOwner\(\)\)\) return refused\((SUGGEST_OWNER_ONLY)?\);/g) || [];
  const exported = actions.match(/export async function \w+Action/g) || [];
  assert(exported.length >= 2 && gates.length === exported.length, `every action checks the owner first (${gates.length}/${exported.length})`);
  const writer = read("src/lib/engine/lpl-crm-write.ts");
  for (const needle of ['iss: CRM_PASS_ISSUER', 'aud: CRM_PASS_AUDIENCE', "htm: method", "htu: path", "CRM_PASS_TTL_SECONDS = 90", '"X-Engine-Pass"', "resolveCrmSecret(env)", "savingOffMessage()", "client_ref: visit.clientRef", 'p_reason: "do_not_contact"', "/rest/v1/rpc/outreach_suppress", "/rest/v1/rpc/outreach_release"]) {
    assertIncludes(writer, needle, "writer contract");
  }
  assertIncludes(writer, "/api/church-crm/leads/${visit.churchId}/activities", "visits go through ChurchConnect");
  assertIncludes(writer, "/api/church-crm/leads/${churchId}/contacts/${contact.id}", "contacts go through ChurchConnect");
  assert(!/console\.(log|error|warn)/.test(writer), "writer never logs");
  assertIncludes(writer, 'if (env.VERCEL_ENV === "production") return {};', "preview bypass never sent from production");
  // PATCH: only a church's basics through ChurchConnect (pass-bound) and a business lead row.
  // Direct PATCHes: a business lead's basics (editOrg) and the guarded lead update (contacts, do-not-contact). Never a church.
  assert((writer.match(/method: "PATCH"/g) || []).length === 2 && writer.includes('fetch(`${config.url}/rest/v1/op_leads?id=eq.${id}${guard}&select=id`, {\n      method: "PATCH"') && writer.includes('fetch(`${config.url}/rest/v1/op_leads?id=eq.${lead.id}${guard}&select=id`, {\n      method: "PATCH"'), "direct PATCHes are business leads only");
  assert(!/rest\/v1\/cc_churches[^`]*`,\s*\{\s*method: "(PATCH|POST|DELETE)"/.test(writer), "never writes cc_churches directly");
  assertIncludes(writer, 'callChurchConnect(cc as CcConfig, "PATCH", `/api/church-crm/leads/${id}`, ownerEmail', "church edits go through ChurchConnect");
  // The only delete: one saved contact (through ChurchConnect, pass-bound). The do-not-contact list is
  // written only through the database's outreach_suppress() / outreach_release() (claims, never a raw delete).
  assertIncludes(writer, 'callChurchConnect(config, "DELETE", `/api/church-crm/leads/${churchId}/contacts/${contactId}`, ownerEmail)', "contact removal goes through ChurchConnect");
  assertIncludes(writer, "return `crm_visit:${churchId}`;", "desk claims carry the church id");
  assert(!/rest\/v1\/outreach_suppressions[^`]*`,\s*\{\s*method: "(POST|DELETE|PATCH)"/.test(writer) && !writer.includes('method: remove ? "DELETE"'), "no raw insert or delete on the do-not-contact list");
  assertIncludes(writer, "if (!released || released.remaining !== 0)", "undo reads back zero claims left");
  assertIncludes(writer, 'if (outcomeCode === "do_not_contact" && input.confirmDnc !== true)', "do-not-contact needs the confirm tick on the server too");
  assert(!writer.includes('"cc_churches", {') && !/rest\/v1\/cc_church[a-z_]*`?, \{\s*method: "(POST|PATCH|PUT)/.test(writer), "church records are only read directly");
  const tools = read("src/components/engine/crm-church-tools.tsx");
  assertIncludes(tools, '"use client"', "client component");
  assert(!tools.includes("lpl-crm-write") && !tools.includes("process.env") && !tools.includes("SERVICE_ROLE"), "client never touches the writer or env");
  assertIncludes(tools, 'name="client_ref" value={clientRef}', "one-time key per form");
  assertIncludes(tools, "disabled={pending}", "button locks while saving");
  assertIncludes(tools, 'name="confirm_dnc" value="yes" required', "confirm tick for do-not-contact");
  assertIncludes(tools, "Yes, never contact this {target.noun}", "confirm wording (church or business)");
  assertIncludes(tools, "card.deskDoNotContact && !mode ? <UndoDoNotContact", "undo shows only for a desk do-not-contact");
  assert(tools.indexOf("Add a contact\n              </button>") < tools.indexOf("card.deskDoNotContact && !mode ? <UndoDoNotContact"), "undo sits below Log a visit / Add a contact");
  assertIncludes(tools, "disabled={pending || (stopping && !confirmed)}", "do-not-contact Save waits for the tick");
  assertIncludes(tools, 'stopping && confirmed ? "Save and stop contact"', "ticked: 'Save and stop contact'");
  assertIncludes(tools, 'stopping && confirmed ? "dx-btn--danger" : "dx-btn--primary"', "ticked: stop style");
  assertIncludes(tools, 'kind === "drop_off" ? "Save drop-off" : kind === "visit" ? "Save visit" : "Save"', "drop-off / visit button label; plain Save until a type is picked");
  assertIncludes(tools, "Yes, remove", "remove asks first");
  assertIncludes(tools, "(contact.email || contact.phone) && mode !== `edit:${contact.id}`", "details not shown twice while editing");
  const desk = read("src/components/engine/crm-desk.tsx");
  assert(!desk.includes("lpl-crm-write"), "desk never imports the writer");
  assert(!/We visited|We dropped off/.test(desk + tools), "in person it was you: no 'We visited' / 'We dropped off'");
  assertIncludes(desk, '"You visited" : touch.kind === "drop_off" ? "You dropped off"', "timeline says You visited / You dropped off");
});

await runStep("pass secret: env var first, else the shared database row; cached; fails closed", async () => {
  const src = read("src/lib/engine/crm-pass-secret.ts");
  assert(!/console\.(log|error|warn|info)/.test(src), "secret module never logs");
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(out).toString("base64")}`);
  const DB_VALUE = "d".repeat(64);
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization });
    return new Response(JSON.stringify([{ value: DB_VALUE }]), { status: 200 });
  };
  const serverEnv = { SUPABASE_URL: "https://lpl.example.test", SUPABASE_SERVICE_ROLE_KEY: "server-key" };
  mod.clearCrmSecretCache();
  assert((await mod.resolveCrmSecret({ ...serverEnv, APPENGINE_CC_CRM_SECRET: "e".repeat(64) }, fetcher, 0)) === "e".repeat(64), "env var wins");
  assert(calls.length === 0, "env var means no database read");
  assert((await mod.resolveCrmSecret(serverEnv, fetcher, 1000)) === DB_VALUE, "database row when no env var");
  assert(calls.length === 1 && calls[0].url.endsWith("/rest/v1/app_shared_secrets?name=eq.cc_crm_owner_desk&select=value&limit=1") && calls[0].auth === "Bearer server-key", "reads only that row with the server key");
  await mod.resolveCrmSecret(serverEnv, fetcher, 1000 + mod.CRM_SECRET_CACHE_MS - 1);
  assert(calls.length === 1, "cached for a few minutes");
  await mod.resolveCrmSecret(serverEnv, fetcher, 1000 + mod.CRM_SECRET_CACHE_MS + 1);
  assert(calls.length === 2, "refreshed after the cache expires");
  // Preview: only the public URL + publishable key, no server key.
  mod.clearCrmSecretCache();
  const previewEnv = { NEXT_PUBLIC_SUPABASE_URL: "https://lpl.example.test", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub", VERCEL_ENV: "preview" };
  assert((await mod.resolveCrmSecret(previewEnv, fetcher, 5000)) === "", "no server key: no secret");
  assert(calls.length === 2, "no server key: no request at all");
  mod.clearCrmSecretCache();
  const broken = async () => new Response("nope", { status: 401 });
  assert((await mod.resolveCrmSecret(serverEnv, broken, 9000)) === "", "unreadable row fails closed");
  const thrower = async () => { throw new Error("network"); };
  mod.clearCrmSecretCache();
  assert((await mod.resolveCrmSecret(serverEnv, thrower, 9000)) === "", "network error fails closed, never throws");
  mod.clearCrmSecretCache();
  const short = async () => new Response(JSON.stringify([{ value: "short" }]), { status: 200 });
  assert((await mod.resolveCrmSecret(serverEnv, short, 9000)) === "", "a short value is refused");
  mod.clearCrmSecretCache();
  assert((await mod.resolveCrmSecret({ APPENGINE_CC_CRM_SECRET: "tooshort" }, fetcher, 0)) === "", "a short env value is refused");
  const writer = read("src/lib/engine/lpl-crm-write.ts");
  assertIncludes(writer, 'return env.VERCEL_ENV === "production" ? "Saving isn\'t switched on yet." : "Saving isn\'t available on this preview.";', "clear fail-closed wording");
  assert((writer.match(/if \(!config\) return \{ ok: false, message: savingOffMessage\(\) \};/g) || []).length === 16 && writer.includes("if (!config || !lpl) return { ok: false, message: savingOffMessage() };"), "every save (church and business: visit, contact, outreach log, remove, undo; business lead; lead queue attach, dismiss, and church search; pipeline status, owner AVL fields, and service opportunities) fails closed");
  // Nothing that runs in the browser may import the secret module.
  for (const rel of ["src/components/engine/crm-church-tools.tsx", "src/components/engine/crm-desk.tsx", "src/components/engine/crm-org-tools.tsx"]) {
    const text = read(rel);
    assert(!text.includes("crm-pass-secret") && !text.includes("app_shared_secrets"), `${rel} never touches the secret`);
  }
});

await runStep("client bundle: no pass secret, secret env name, or secrets table (when .next exists)", () => {
  const dir = path.join(repoRoot, ".next", "static");
  if (!fs.existsSync(dir)) {
    console.log("     (skipped: run after next build)");
    return;
  }
  const needles = ["APPENGINE_CC_CRM_SECRET", "app_shared_secrets", "cc_crm_owner_desk", "SUPABASE_SERVICE_ROLE_KEY"];
  if ((process.env.APPENGINE_CC_CRM_SECRET || "").length >= 32) needles.push(process.env.APPENGINE_CC_CRM_SECRET);
  const hits = [];
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|css|json|html|txt)$/.test(entry.name)) {
        const text = fs.readFileSync(full, "utf8");
        for (const needle of needles) if (text.includes(needle)) hits.push(`${path.relative(repoRoot, full)} has ${needle.length > 40 ? "the secret value" : needle}`);
      }
    }
  };
  walk(dir);
  assert(hits.length === 0, hits.join("; "));
});

await runStep("church rule: exactly five offers (Messenger AVL added Oct 17), never a business tool, never 'marketing'", async () => {
  const src = read("src/lib/engine/church-offer-rule.ts");
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const rule = await import(`data:text/javascript;base64,${Buffer.from(out).toString("base64")}`);
  // Pinned. ChurchConnect's backend/utils/church_offer_rule.py pins the same list.
  assert(JSON.stringify(rule.CHURCH_OFFER_IDS) === JSON.stringify(["churchconnect", "easypeazy", "laser", "outreach", "messenger_avl"]), "exactly five");
  assert(rule.CHURCH_ALLOWED_OFFERS.messenger_avl === "Church sound, video & lighting" && rule.MESSENGER_AVL_URL === undefined, "service label, no outbound link");
  assert(rule.churchProductOf("MessengerAVL") === "messenger_avl" && rule.allowedForChurch("messenger_avl"), "Messenger AVL is a church choice");
  assert(rule.CHURCH_ALLOWED_OFFERS.outreach === "ChurchConnect: Outreach (Live on Mission)" && rule.OUTREACH_URL === "https://live-on-mission.com/outreach", "Outreach → Live On Mission");
  assert(rule.churchProductOf("directory") === "churchconnect", "directory is ChurchConnect");
  for (const banned of [...rule.NEVER_FOR_CHURCHES, "operate", "toner", "", null, "marketing"]) assert(!rule.allowedForChurch(banned), `never ${banned}`);
  assert(rule.hasForbiddenChurchWord("church marketing") && !rule.hasForbiddenChurchWord("Outreach with Live On Mission"), "marketing caught");
  const kept = rule.filterChurchOffers([{ id: "churchconnect", pitch: "Enter once." }, { id: "operate", pitch: "x" }, { id: "outreach", pitch: "Church marketing" }, "laser", "toner"]);
  assert(JSON.stringify(kept.map((k) => (typeof k === "string" ? k : k.id))) === '["churchconnect","laser"]', "filter checks ids and words");
});

await runStep("slice 2: church or business — unclear is a church; a church only sees church apps", async () => {
  const core = await loadCore();
  const src = read("src/lib/engine/church-offer-rule.ts");
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const rule = await import(`data:text/javascript;base64,${Buffer.from(out).toString("base64")}`);
  assert(core.resolveOrgKind("unsure", "Joe's Tires", false).kind === "church", "not sure = church");
  assert(core.resolveOrgKind("", "Anything", false).kind === "church", "blank = church");
  assert(core.resolveOrgKind("church", "Joe's Tires", false).kind === "church", "church stays church");
  assert(core.resolveOrgKind("business", "Joe's Tires", false).kind === "business", "a plain business");
  assert("error" in core.resolveOrgKind("business", "Grace Baptist Church", false), "church-sounding business needs a tick");
  assert(core.resolveOrgKind("business", "Grace Baptist Church", true).kind === "business", "…and then it's a business");
  for (const name of ["First Baptist", "St. Mark AME", "New Hope Fellowship", "Canton Chapel"]) assert(core.looksLikeChurch(name), `church word: ${name}`);
  for (const name of ["Joe's Tires", "Canton Florist", "Main Street Market"]) assert(!core.looksLikeChurch(name), `not a church: ${name}`);
  const churchIds = rule.offerChoices("church").map((choice) => choice.id);
  assert(JSON.stringify(churchIds) === JSON.stringify(rule.CHURCH_OFFER_IDS), "church choices are exactly the rule");
  for (const choice of rule.offerChoices("church")) assert(!rule.hasForbiddenChurchWord(choice.label), `no 'marketing' for a church: ${choice.label}`);
  assert(!churchIds.some((id) => ["operate", "awd", "marketing_campaign", "toner", "presence"].includes(id)), "never a business tool for a church");
  assert(JSON.stringify(rule.cleanChurchOfferIds(["operate", "outreach", "directory", "marketing_campaign", "laser"])) === '["churchconnect","laser","outreach"]', "server cleans church picks");
  assert(JSON.stringify(rule.cleanBusinessOfferIds(["operate", "nope", "laser"])) === '["operate","laser"]', "server cleans business picks");
  // Domains are addresses, not words: Laser's .market domain no longer drops Laser.
  assert(rule.filterChurchOffers([{ id: "laser", name: "Laser church gifts", url: "https://laser.engrave.market" }]).length === 1, "laser survives the word check");
  // Admins never see an org's phone or email.
  const org = { kind: "church", id: "1", name: "A", city: "B", state: "GA", website: "", phone: "770-555-0100", email: "a@b.org", offers: [] };
  const seen = core.orgForViewer(org, false);
  assert(seen.phone === "" && seen.email === "" && seen.name === "A", "admin view strips phone and email");
  assert(core.orgForViewer(org, true).phone === "770-555-0100", "owner sees them");
  // A church card that also has a business lead edits the church.
  const cards = core.buildCards(
    [
      node({ id: "cc:church:1", domains: ["grace.example"], org: { ...org, id: "c1", kind: "church" } }),
      node({ id: "op:lead:1", app: "business", domains: ["grace.example"], org: { ...org, id: "b1", kind: "business" } })
    ],
    none(),
    NOW
  );
  assert(cards.length === 1 && cards[0].org.kind === "church" && cards[0].apps.includes("business"), "church first on a joined card");
  assert(core.CRM_APP_LABEL.business === "Business lead", "business pill label");
  // Our church apps read as ChurchConnect; the partner (Messenger AVL) reads by its own name; EasyPeazy is one word; Marketing campaign hidden until it exists.
  assert(JSON.stringify(rule.offerChoices("church").map((c) => c.label)) === JSON.stringify(["ChurchConnect", "ChurchConnect: church website", "ChurchConnect: Laser church gifts", "ChurchConnect: Outreach (Live on Mission)", "Church sound, video & lighting"]), "church labels");
  const biz = rule.offerChoices("business");
  assert(JSON.stringify(biz.map((c) => c.id)) === '["operate","awd","easypeazy","laser"]' && rule.MARKETING_CAMPAIGN_LIVE === false, "marketing campaign hidden behind the flag");
  assert(JSON.stringify(rule.cleanBusinessOfferIds(["marketing_campaign", "operate"])) === '["operate"]', "a hidden offer can't be saved");
  assert(biz.find((c) => c.id === "awd").hint && biz.find((c) => c.id === "easypeazy").hint && biz.find((c) => c.id === "easypeazy").label === "EasyPeazy website", "hints + EasyPeazy one word");
  assert(!/Easy Peazy/.test(JSON.stringify([...rule.offerChoices("church"), ...biz])), "never 'Easy Peazy'");
});

await runStep("slice 2: adding looks for duplicates first; churches hidden; nothing sent", () => {
  const writer = read("src/lib/engine/lpl-crm-write.ts");
  const create = writer.slice(writer.indexOf("export async function createOrg"), writer.indexOf("async function insertBusinessLead"));
  const check = create.indexOf("findOrgMatches(org)");
  assert(check > 0 && check < create.indexOf("callChurchConnect") && check < create.indexOf("insertBusinessLead(org)"), "match check runs before any save");
  assertIncludes(writer, "if (matches === null) return { ok: false", "no check = no save");
  assertIncludes(writer, "if (matches.some((match) => match.hard))", "same name + town is never added twice");
  for (const needle of ['"same name and town"', '"same website"', '"same phone"', '"same email"']) assertIncludes(writer, needle, "match reasons");
  assertIncludes(writer, 'callChurchConnect(cc as CcConfig, "POST", "/api/church-crm/leads", ownerEmail', "churches go through ChurchConnect");
  assertIncludes(writer, "send_invite: false", "a business lead never queues an invite");
  assertIncludes(writer, 'source: "appengine_crm"', "business rows are marked as desk rows");
  assert(!/is_public:\s*true/.test(writer), "never makes a church public");
  assert((writer.match(/if \(org\.kind === "church" && !cc\) return \{ ok: false, message: savingOffMessage\(\) \};/g) || []).length === 1, "add fails closed without the pass");
  assert((writer.match(/if \(kind === "church" && !cc\) return \{ ok: false, message: savingOffMessage\(\) \};/g) || []).length === 1, "edit fails closed without the pass");
  const actions = read("src/app/(cockpit)/crm/actions.ts");
  for (const name of ["addOrgAction", "editOrgAction"]) assertIncludes(actions, `export async function ${name}`, "org actions");
  const tools = read("src/components/engine/crm-org-tools.tsx");
  assertIncludes(tools, '"use client"', "client component");
  assert(!tools.includes("lpl-crm-write") && !tools.includes("process.env"), "client never touches the writer or env");
  assertIncludes(tools, "Not sure is saved as a church", "not-sure wording");
  assertIncludes(tools, "Yes, this is a business, not a church", "church-name guard wording");
  assertIncludes(tools, "Open it", "offer to open the existing one");
  assertIncludes(tools, "if ((next === \"business\") !== (kind === \"business\")) setDraft((current) => ({ ...current, offers: [] }));", "switching kind clears the app picks");
  assertIncludes(tools, "{hard ? null : (", "same name + town hides the add button");
  assertIncludes(tools, "disabled={pending || (matches.length > 0 && !confirmNew)}", "'Add anyway' waits for the different-one tick");
  assertIncludes(tools, "This name sounds like a church. Tick to confirm it&apos;s a business.", "church-name line above the tick");
  assertIncludes(tools, "{matches.length ? null : <Status state={state} />}", "one duplicate message, not two");
  assertIncludes(tools, "Name (required)", "required marked");
  const deskSrc = read("src/components/engine/crm-desk.tsx");
  assertIncludes(deskSrc, "`Only in ${businessApps[0]}`", "one app: 'Only in Operate'");
  assertIncludes(deskSrc, "`In ${businessApps.slice(0, -1).join(\", \")} and ${businessApps[businessApps.length - 1]}`", "several apps: 'In Operate and AI Website Design'");
  assertIncludes(tools, '{editing ? "Edit details and apps"', "edit form has its own heading");
  assertIncludes(writer, "if (current !== null && current !== org.email) body.contact_email = org.email;", "church email sent only when it changed");
  assertIncludes(tools, "value={draft.name}", "fields are controlled, so a match answer never wipes what was typed");
  assertIncludes(tools, "disabled={pending}", "button locks while saving");
  const desk = read("src/components/engine/crm-desk.tsx");
  assertIncludes(desk, "{canSave ? <AddOrg onOpen={openOrg} /> : null}", "add is owner-only");
  const page = read("src/app/(cockpit)/crm/page.tsx");
  assertIncludes(page, "org: orgForViewer(card.org, isOwner)", "page strips org contact details for admins");
});

await runStep("slice 3: business contacts, visits and drop-offs reuse the church forms; rest 14 / 7; do-not-contact with undo", async () => {
  // Cards: a business-only card saves to its lead; a church card never saves to a lead.
  const biz = node({ id: "op:lead:L1", app: "business", name: "Fixture Tires", leadId: "11111111-2222-4333-8444-555555555555",
    contacts: [{ id: "c-owner-1", name: "Sam Owner", title: "Owner", email: "sam@fixture-tires.test", phone: "555-010-0100", source: "saved" }],
    touches: [{ at: daysAgo(3), app: "business", kind: "visit", what: "Visit, met Sam O.", outreach: true, restDays: 14 }] });
  const church = node({ id: "cc:church:C1", name: "Fixture Chapel", churchId: "99999999-2222-4333-8444-555555555555", contacts: [] });
  const cards = buildCards([biz, church], none(), NOW);
  const b = cardFor(cards, "Fixture Tires");
  const c = cardFor(cards, "Fixture Chapel");
  assert(b.leadId === "11111111-2222-4333-8444-555555555555" && b.churchId === null, "business card saves to its lead");
  assert(c.churchId && c.leadId === null, "church card never saves to a lead");
  assert(b.contacts.length === 1 && b.contacts[0].source === "saved", "business contacts are editable");
  assert(b.repeat.level === "hold" && b.repeat.text.startsWith("You visited 3 days ago."), `business visit rests 14 days: ${b.repeat.text}`);
  const dropCards = buildCards([node({ ...biz, touches: [{ at: daysAgo(8), app: "business", kind: "drop_off", what: "Drop-off", outreach: true, restDays: 7 }] })], none(), NOW);
  assert(dropCards[0].repeat.level !== "hold", "business drop-off rests 7 days");
  const dnc = buildCards([node({ ...biz, deskDoNotContact: true, declined: "Asked not to be contacted. Do not reach out from any app." })], none(), NOW);
  assert(dnc[0].deskDoNotContact === true, "a desk do-not-contact on a business can be undone");
  const listed = buildCards([node({ ...biz, phones: ["7705550111"], deskDoNotContact: true, declined: "Asked not to be contacted. Do not reach out from any app." })], { emails: new Set(), domains: new Set(), phones: new Set(["7705550111"]) }, NOW);
  assert(listed[0].stops.length === 1 && listed[0].stops[0].reason === "declined", `one stop, not two: ${JSON.stringify(listed[0].stops)}`);
  const onlyListed = buildCards([node({ ...biz, phones: ["7705550111"] })], { emails: new Set(), domains: new Set(), phones: new Set(["7705550111"]) }, NOW);
  assert(onlyListed[0].stops.some((stop) => stop.reason === "suppressed"), "the list alone still stops the card");
  const viewer = core.contactsForViewer(b.contacts, false);
  assert(viewer[0].email === "" && viewer[0].phone === "", "admins never see business contact details");

  // Writer: same validation, its own table, idempotent, guarded, undo removes only its rows.
  const writer = read("src/lib/engine/lpl-crm-write.ts");
  for (const needle of [
    "/rest/v1/op_lead_activities?on_conflict=client_ref&select=id",
    'Prefer: "resolution=ignore-duplicates,return=representation"',
    "created_by: ownerEmail",
    "return `crm_visit:op_lead:${leadId}`;",
    'status: "suppressed", signals',
    'if (signals.dnc_source !== "crm_visit") return',
    "if (!released || released.remaining !== 0)",
    "const LEAD_CONTACT_LIMIT = 25;",
    "updated_at=eq.${encodeURIComponent(lead.updated_at)}",
    "return `${day}T16:00:00.000Z`;",
    "if (visit.leadId || !visit.churchId) return"
  ]) assertIncludes(writer, needle, "business writer contract");
  assert(!/send_invite:\s*true/.test(writer), "never turns on an invite");
  const actions = read("src/app/(cockpit)/crm/actions.ts");
  assertIncludes(actions, 'const leadOf = (formData: FormData) => field(formData, "lead_id").trim();', "forms carry lead_id for a business");
  for (const fn of ["saveBusinessContact", "logBusinessVisit", "removeBusinessContact", "undoBusinessDoNotContact"]) assertIncludes(actions, fn, "business action wired");

  // Reader: the visit log feeds the timeline, the rest and the next step.
  const reader = read("src/lib/engine/lpl-crm.ts");
  assertIncludes(reader, 'read("op_lead_activities"', "reads the business visit log");
  assertIncludes(reader, 'const touch = visitTouch(entry, type, "business");', "business visits use the same touch (rest 14 / 7)");
  assertIncludes(reader, "deskDoNotContact: status === \"suppressed\" && s(signals.dnc_source) === \"crm_visit\"", "undo only for a desk do-not-contact");
  assertIncludes(reader, "leadId: id,", "business node carries its lead id");

  // UI: one set of forms, the target decides where it saves.
  const tools = read("src/components/engine/crm-church-tools.tsx");
  assertIncludes(tools, '<input type="hidden" name={target.field} value={target.id} />', "forms post church_id or lead_id");
  assert(!tools.includes('name="church_id"'), "no hard-wired church field left");
  assertIncludes(tools, 'if (card.churchId) return { field: "church_id"', "a church wins over a lead");
  assert(!/export function (Business|Lead)\w*Tools/.test(tools), "no parallel business component");

  // EA round 3: undo never reopens a lead still on the list elsewhere; tagged rows are always removable.
  const undo = writer.slice(writer.indexOf("export async function undoBusinessDoNotContact"));
  assert(undo.indexOf("existingSuppressions(config, own)") > undo.indexOf("if (!released || released.remaining !== 0)"), "undo checks the list after releasing its own claim");
  assertIncludes(undo, "...(normDomain(lead.website_url) ? [{ domain: normDomain(lead.website_url) }] : [])", "the re-check includes the website domain");
  // Fail closed stays retryable: nothing (not even dnc_source) is cleared before the check succeeds and the save lands.
  assert(undo.indexOf("if (still === null) return { ok: false") < undo.indexOf("delete cleared.dnc_source;") && !undo.includes("delete signals.dnc_source"), "an unchecked undo keeps dnc_source so Undo can be tried again");
  assertIncludes(undo, "Still blocked. ${name} was already marked do-not-contact before this", "status-only stop is not called 'on the list'");
  // Church undo: release the desk claim first, ChurchConnect keeps other reasons, then re-check the shared list.
  const cundo = writer.slice(writer.indexOf("export async function undoChurchDoNotContact"), writer.indexOf("// ── Add or edit an org"));
  assert(cundo.indexOf("releaseClaim(lpl, deskSuppressionSource(churchId))") < cundo.indexOf("/do-not-contact/undo"), "church: claim released before ChurchConnect undo (retryable)");
  assertIncludes(cundo, "if (result.json?.still_stopped === true)", "church: ChurchConnect's own other reason keeps it blocked");
  assertIncludes(cundo, "const still = await existingSuppressions(lpl, reach.rows);", "church: re-checks email, phone and website on the shared list");
  // EA r3 shoulds: a failed check or a failed ChurchConnect undo leaves the desk stop, so Undo stays and can be retried.
  assert(cundo.indexOf("if (still === null) {") < cundo.indexOf("/do-not-contact/undo"), "church: shared list checked before ChurchConnect is touched");
  assert(/if \(still === null\) \{\s*return \{ ok: false/.test(cundo), "church: unchecked list fails (Undo stays), not a success");
  assertIncludes(cundo, "ChurchConnect didn't confirm the undo, so this church stays stopped. Try Undo again.", "church: CC undo failure after release keeps it stopped and retryable");
  assert(!cundo.includes("Still blocked for now"), "no 'treat as blocked' success that hides Undo");
  assert(cundo.indexOf("readChurchReach(lpl, churchId)") < cundo.indexOf("releaseClaim("), "church: reach read before anything changes");
  assertIncludes(cundo, "Still on the do-not-contact list. ${stillListedReason(name", "church: says it's still blocked");
  // Every writer sends phone as 10 digits (registry rule); both claim paths go through suppressionRowsFor.
  assert(core.normPhone("+1 (404) 555-0143") === "4045550143" && core.normPhone("555-0143") === "" && core.normPhone("404-555-0143 ext. 12") === "4045550143" && core.normPhone("912-555-0100 #12") === "9125550100", "phone normalized to 10 digits before suppress()");
  assert(core.suppressionPhone("555-0199") === "5550199" && core.suppressionPhone("912-555-0100 #12") === "9125550100", "a 7-digit number is kept for suppression, and a #12 extension is stripped");
  const seven = { emails: new Set(), domains: new Set(), phones: new Set(["5550199"]) };
  assert(core.rowMatchesSuppression({ phone: "555-0199" }, seven) === true && core.rowMatchesSuppression({ phone: "912-555-0199" }, seven) === false, "a 7-digit suppression matches only a 7-digit number");
  const crowdedMail = { emails: new Set(["pastor@shared.example"]), domains: new Set(["shared.example"]), phones: new Set() };
  const crowdedHosts = new Set(["shared.example"]);
  assert(core.rowMatchesSuppression({ email: "office0@shared.example", website: "https://shared.example" }, crowdedMail, crowdedHosts) === false, "a crowded domain does not suppress every church on it");
  assert(core.rowMatchesSuppression({ email: "pastor@shared.example", website: "https://shared.example" }, crowdedMail, crowdedHosts) === true, "the exact email on a crowded domain still matches");
  for (const host of ["gmail.com", "bellsouth.net", "yahoo.co.uk", "pm.me", "linktr.ee", "watchtower.org", "churchfinder.com", "sites.google.com", "tithe.ly", "iphc.org", "cogop.org", "nc.rr.com", "churchofgod.cc", "churchofgod.org", "sgaumc.org", "ngumc.org", "umc.org", "nccumc.org", "churchangel.com", "chamberofcommerce.com", "inallthingspray.org", "local.churchofjesuschrist.org", "churchofjesuschrist.org", "giv.li", "yellowpages.com", "bizapedia.com", "ame-church.com", "nazarene.org", "charlestondiocese.org", "pcusa.org", "netministries.org", "dandb.com", "knology.net", "church-of-christ.org"]) {
    assert(core.suppressionDomain(host) === "" && core.suppressionDomain(`https://www.${host}/church`) === "", `suppression domain skipped: ${host}`);
  }
  assert(core.suppressionDomain("https://gracebaptist.example/home") === "gracebaptist.example", "a church's own site still matches");
  const genericIndex = { emails: new Set(), domains: new Set(["gmail.com", "sgaumc.org", "gracebaptist.example"]), phones: new Set() };
  assert(core.rowMatchesSuppression({ email: "pastor@gmail.com", website: "https://sgaumc.org/ailey", phone: "" }, genericIndex) === false, "generic domains do not suppress by themselves");
  assert(core.rowMatchesSuppression({ email: "pastor@gmail.com", website: "", phone: "" }, { emails: new Set(["pastor@gmail.com"]), domains: new Set(["gmail.com"]), phones: new Set() }) === true, "the same address still matches as an exact email");
  assert(core.rowMatchesSuppression({ email: "", website: "https://www.gracebaptist.example", phone: "404-555-0143 x12" }, { emails: new Set(), domains: new Set(["gracebaptist.example"]), phones: new Set(["4045550143"]) }) === true, "own domain and extension-stripped phone still match");
  assertIncludes(writer, "claimSuppressions(config, suppressionRowsFor(church)", "church claims use normalized rows");
  assertIncludes(writer, "claimSuppressions(config, leadSuppressionRows(lead)", "business claims use normalized rows");
  assertIncludes(read("source-of-truth/super-admin-registry.md"), "phone as exactly 10 digits", "registry: writers send phone as 10 digits");
  // Domains are added from the website only (never an email provider's domain).
  const rowsFn = writer.slice(writer.indexOf("export function suppressionRowsFor"), writer.indexOf("async function addChurchToDoNotContact"));
  assert(!rowsFn.includes("domainFromEmail"), "no domain rows from email addresses");
  for (const host of ["sbcglobal.net", "cox.net", "earthlink.net", "frontier.com", "rr.com", "juno.com", "embarqmail.com", "centurylink.net", "aim.com", "att.net", "bellsouth.net", "verizon.net", "comcast.net", "charter.net", "windstream.net", "msn.com", "live.com", "me.com", "mac.com", "ymail.com", "protonmail.com"]) {
    assert(core.domainFromEmail(`a@${host}`) === "", `free-mail host is not an org domain: ${host}`);
  }
  assertIncludes(reader, "truthy(row.do_not_contact_desk_claim) ||", "church undo shows for the desk's claim even beside an unsubscribe");
  assertIncludes(reader, 's(row.do_not_contact_source) === "email_unsubscribe"', "church unsubscribe reads 'Opted out'");
  assertIncludes(undo, 'const status = elsewhere || prevRaw === "suppressed" ? "suppressed" : prevRaw;', "still listed elsewhere (or stopped before) stays suppressed");
  assertIncludes(undo, "Still on the do-not-contact list. ${stillListedReason(name", "leads with the result, then why");
  assert(!writer.includes("Your do-not-contact entries were removed"), "no 'Your do-not-contact entries were removed'");
  assertIncludes(undo, "return { ok: true, warn: true, message: `Still on the do-not-contact list.", "still-listed is a warning, not a success");
  const reasonFn = new Function(writer.slice(writer.indexOf("export function stillListedReason")).split("\n}\n")[0].replace("export function stillListedReason(name: string, reasons: string[]): string", "return function (name, reasons)") + "\n}")();
  assert(reasonFn("Peach Bakery", ["opt_out"]) === "Peach Bakery opted out themselves", "opted out");
  assert(reasonFn("Peach Bakery", ["bounce"]) === "Peach Bakery's email bounced", "bounced");
  assert(reasonFn("Peach Bakery", ["do_not_contact"]) === "Peach Bakery is on the list for another reason", "another reason");
  assertIncludes(read("src/app/(cockpit)/crm/actions.ts"), "warn: result.ok && result.warn === true", "the warning reaches the card");
  assertIncludes(tools, '${notice.warn ? "crm-card-notice--stop" : "crm-ok-text"}', "warning uses the stop tone, success the lime");
  const css = read("src/app/styles.css");
  assertIncludes(css, ".crm-page .crm-card-notice { margin: 0 0 8px; }", "8px between a confirmation and the button below");
  assertIncludes(undo, '"Undone. You can contact this business again."', "undo wording (business)");
  assertIncludes(writer, '"Undone. You can contact this church again."', "undo wording (church)");
  assert(!writer.includes("back on the list") && !writer.includes("back in the pipeline"), "old undo wording gone");
  const add = writer.slice(writer.indexOf("async function addLeadToDoNotContact"), writer.indexOf("export async function undoBusinessDoNotContact"));
  assert(!add.includes('if (lead.status === "suppressed") return true;'), "an already-suppressed lead still gets dnc_source, so its tagged rows can be undone");
  assertIncludes(add, 'signals.dnc_source = "crm_visit";', "always tags the lead");
  assertIncludes(add, "claimSuppressions(config, leadSuppressionRows(lead), leadSuppressionSource(lead.id))", "adds claims through outreach_suppress (no repeat rows; a real reason keeps its row)");
  // editOrg (business): stale-save check and services merged, not replaced.
  const edit = writer.slice(writer.indexOf("export async function editOrg"), writer.indexOf("export function mergeBusinessServices"));
  assertIncludes(edit, "if (version && row.updated_at && version !== row.updated_at) return { ok: false, message: STALE };", "stale form refused");
  assertIncludes(edit, "const services = mergeBusinessServices(row.services, org.offers);", "services merged");
  const merge = new Function("BUSINESS_OFFER_IDS", writer.slice(writer.indexOf("export function mergeBusinessServices")).split("\n}\n")[0].replace("export function mergeBusinessServices(current: unknown, picked: string[]): string[]", "return function (current, picked)").replace("new Set<string>(", "new Set(") + "\n}");
  const merged = merge(["operate", "awd"])(["toner_legacy", "operate"], ["awd"]);
  assert(JSON.stringify(merged) === JSON.stringify(["toner_legacy", "awd"]), `merge keeps hidden services, replaces shown ones: ${JSON.stringify(merged)}`);
  assertIncludes(read("src/components/engine/crm-org-tools.tsx"), 'name="org_version" value={org.version}', "edit form carries the version");
  assertIncludes(reader, "version: s(row.updated_at)", "business org carries its version");
  // Banner worded by source.
  for (const line of ['"Opted out. Do not reach out from any app."', '"Email bounced. Do not reach out from any app until the address is fixed."', '"On the do-not-contact list. Do not reach out from any app."']) assertIncludes(reader, line, "stop line by source");
  const bounced = buildCards([node({ ...biz, phones: ["7705550111"], declined: "Email bounced. Do not reach out from any app until the address is fixed." })], { emails: new Set(), domains: new Set(), phones: new Set(["7705550111"]) }, NOW);
  assert(bounced[0].stops.length === 1, `bounced: one stop, not two: ${JSON.stringify(bounced[0].stops)}`);
  // Confirmations stay on the card after save and undo.
  assertIncludes(tools, "useSyncExternalStore(subscribeNotices", "confirmation survives the card re-rendering");
  assertIncludes(tools, "onDone(result.message);", "the server's own words are shown, handed over inside the action (the re-render can unmount the form)");
  assertIncludes(tools, "<UndoDoNotContact target={target} onDone={done} />", "undo confirmation moves to the card");
  assertIncludes(tools, "Saved to your CRM only. Nothing is sent to anyone.", "CRM-only line");
  assertIncludes(writer, "`${label} saved.`", "'Visit saved.' / 'Drop-off saved.'");
  assert(!tools.includes("The card updates in a moment"), "old vague save line gone");
  assert(!read("src/app/(cockpit)/crm/page.tsx").includes(",,"), "no double comma");
});

await runStep("plain words on screen — no vendor names", () => {
  const screens = read("src/app/(cockpit)/crm/page.tsx") + read("src/components/engine/crm-desk.tsx") + read("src/components/engine/crm-church-tools.tsx") + read("src/components/engine/crm-org-tools.tsx");
  const visible = screens.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/import[^;]+;/g, "");
  for (const vendor of ["Supabase", "supabase", "Vercel", "Stripe", "Resend", "Neon", "PostgREST", "jsonb"]) {
    assert(!visible.includes(vendor), `vendor word on screen: ${vendor}`);
  }
});

if (failures) {
  console.error(`\n${failures} CRM smoke step(s) failed.`);
  process.exit(1);
}
console.log("\nCRM smoke passed.");
