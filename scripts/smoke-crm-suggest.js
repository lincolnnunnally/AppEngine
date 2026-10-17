// Suggested next step (CRM v2 slice 4): the church rule filter, do-not-contact
// and rest suppression, minimal data to the model, fail-closed and cache, and no
// vendor name on screen or in the browser bundle.
//   node scripts/smoke-crm-suggest.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), "utf8");
let failed = 0;
async function step(label, fn) {
  try {
    await fn();
    console.log(`ok   ${label}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${label}\n     ${error.message}`);
  }
}
function assert(cond, label) {
  if (!cond) throw new Error(label);
}
const toUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
function transpile(rel, replace = {}) {
  let out = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [from, to] of Object.entries(replace)) out = out.split(`"${from}"`).join(`"${to}"`);
  return out;
}
// "server-only" throws outside a React Server build; in this plain-node smoke it is an empty module.
const serverOnlyUrl = toUrl("export {};");
const ruleUrl = toUrl(transpile("src/lib/engine/church-offer-rule.ts"));
const coreUrl = toUrl(transpile("src/lib/engine/crm-suggest-core.ts", { "./church-offer-rule": ruleUrl }));
const xaiUrl = toUrl(transpile("src/lib/xai.ts", { "server-only": serverOnlyUrl }));
const rule = await import(ruleUrl);
const core = await import(coreUrl);
const server = await import(toUrl(transpile("src/lib/engine/crm-suggest.ts", { "server-only": serverOnlyUrl, "@/lib/xai": xaiUrl, "@/lib/engine/crm-suggest-core": coreUrl })));

const NOW = new Date("2026-10-17T16:00:00Z");
const TODAY = "2026-10-17";
function card(over = {}) {
  return {
    key: "church:c1",
    name: "Grace Fellowship",
    town: "Covington, GA",
    apps: ["churchconnect"],
    touches: [
      { at: "2026-10-01T15:00:00Z", app: "churchconnect", kind: "visit", what: "Visit — met Jane D., she gave jane@grace.example and 404-555-0143", outreach: true },
      { at: "2026-09-20T15:00:00Z", app: "churchconnect", kind: "invite", what: "Invite email", outreach: true, signal: false }
    ],
    repeat: { level: null, text: "" },
    stops: [],
    followUpReasons: ["due"],
    nextStep: "Call Pastor Sam at (404) 555-0199 or sam@grace.example",
    nextActionDate: "2026-10-17",
    churchId: "c0ffee00-0000-4000-8000-000000000001",
    leadId: null,
    org: { kind: "church", id: "c1", name: "Grace Fellowship", city: "Covington", state: "GA", website: "", phone: "404-555-0100", email: "office@grace.example", offers: ["churchconnect"] },
    contacts: [
      { id: "x", name: "Jane Doe", title: "Secretary", email: "jane@grace.example", phone: "4045550143", source: "saved" },
      { id: "p", name: "Sam Q. Rivers", title: "Pastor", email: "", phone: "", source: "pastor" }
    ],
    ...over
  };
}
const business = (over = {}) =>
  card({
    key: "business:b1",
    name: "Peach Bakery",
    apps: ["business"],
    churchId: null,
    leadId: "b0000000-0000-4000-8000-000000000001",
    org: { kind: "business", id: "b1", name: "Peach Bakery", city: "Covington", state: "GA", website: "", phone: "", email: "", offers: ["operate"] },
    ...over
  });

await step("church rule: a model answer that suggests Operate for a church is dropped", () => {
  const out = core.cleanSuggestion("church", JSON.stringify({ next_step: "Offer Operate to run their front office", app: "operate", when_days: 2, why: "Saves time" }), card(), TODAY);
  assert(out === null, `expected null, got ${JSON.stringify(out)}`);
  // Off-list app id with harmless words: still dropped (the model went off the list).
  assert(core.cleanSuggestion("church", { next_step: "Drop by on Sunday", app: "operate", when_days: 1 }, card(), TODAY) === null, "operate app id dropped");
  // An allowed app with Operate named in the text: dropped.
  assert(core.cleanSuggestion("church", { next_step: "Show them Operate and the toner deal", app: "churchconnect" }, card(), TODAY) === null, "Operate in text dropped");
  // 'marketing' is never said to a church.
  assert(core.cleanSuggestion("church", { next_step: "Talk about marketing their events", app: "easypeazy" }, card(), TODAY) === null, "marketing dropped");
  for (const id of ["awd", "ai_website_design", "toner", "neighborly", "presence", "group_buy", "marketing_campaign"]) {
    assert(core.cleanSuggestion("church", { next_step: "Stop by", app: id }, card(), TODAY) === null, `${id} dropped for a church`);
  }
});

await step("church rule: allowed church offers pass, labelled as ChurchConnect", () => {
  const ok = core.cleanSuggestion("church", { next_step: "Stop by with a welcome gift and show the church website preview", app: "easypeazy", when_days: 3, why: "They asked about a site." }, card(), TODAY);
  assert(ok && ok.appId === "easypeazy" && ok.appLabel === "ChurchConnect: church website" && ok.when === "2026-10-20", JSON.stringify(ok));
  const dir = core.cleanSuggestion("church", { next_step: "Invite them to the directory", app: "directory" }, card(), TODAY);
  assert(dir && dir.appId === "churchconnect" && dir.appLabel === "ChurchConnect", "directory maps to ChurchConnect");
  const lom = core.cleanSuggestion("church", { next_step: "Share the Live on Mission outreach idea", app: "outreach" }, card(), TODAY);
  assert(lom && lom.appLabel === "ChurchConnect: Outreach (Live on Mission)", "Outreach (Live on Mission) allowed");
  const none = core.cleanSuggestion("church", { next_step: "Call back next week", app: "" }, card(), TODAY);
  assert(none && none.appId === "" && none.appLabel === "", "no app is fine");
  assert(core.cleanSuggestion("church", "not json", card(), TODAY) === null && core.cleanSuggestion("church", { app: "laser" }, card(), TODAY) === null, "bad answers dropped");
  const scrubbed = core.cleanSuggestion("church", { next_step: "Call 404-555-0101 or email a@b.co to set a visit", app: "" }, card(), TODAY);
  assert(scrubbed && !/555|@/.test(scrubbed.nextStep), "emails/phones removed from the answer");
  for (const phone of ["+1 404.555.0143", "404 555 0143 x12", "4045550143", "(404)555-0143", "+44 20 7946 0958"]) {
    const out = core.cleanSuggestion("church", { next_step: `Call the office at ${phone} to set a visit`, app: "" }, card(), TODAY);
    assert(out && !/\d{3}/.test(out.nextStep), `phone ${phone} removed: ${out && out.nextStep}`);
  }
});

// EA r1: every probe that used to pass must now be dropped (after normalizing).
const CHURCH_MUST_DROP = [
  "Bring them Toners for the office printer",
  "Tell them about the Group-Buy",
  "Mention the Groupbuy for supplies",
  "Invite them to group buying with other churches",
  "Show them Ops for the front desk",
  "Offer website design for the church",
  "Offer web design help",
  "Introduce Neighbourly",
  "Introduce Neighborly",
  "Show them Op\u0435rate", // Cyrillic \u0435
  "Talk about mark\u0435ting their events", // Cyrillic \u0435
  "Talk about \uFF2Darketing their events", // full-width \uFF2D
  "Show them \u039F\u0440erate", // Greek \u039F + Cyrillic \u0440
  "Show them O-p-e-r-a-t-e",
  "Show them O.p.e.r.a.t.e",
  "Show them O p e r a t e",
  "Show them Op\u200Berate", // zero-width space
  "Suggest m-a-r-k-e-t-i-n-g",
  "Run some ads for Easter",
  "Place an ad in the paper",
  "Talk about advertising their services",
  "Plan a campaign for Easter",
  "Help with social media posts",
  "Improve their SEO",
  "Improve their S.E.O.",
  "Offer to promote their events",
  "Help them grow your audience online",
  "Help them grow their audience"
];
const PROMISES = [
  "Offer a free church website",
  "Offer a FREE gift box",
  "Mention the discount on Laser gifts",
  "Tell them it's 20% off this month",
  "Tell them it's 20 % off",
  "Guarantee a site by Friday",
  "Mention the guaranteed results",
  "Tell them about the deal on gifts",
  "Gift boxes start at $25",
  "Gift boxes are $ 25 each",
  "Gift boxes are \uFF0425 each" // full-width dollar
];
const CHURCH_MUST_PASS = [
  "Stop by with a welcome gift and mention the ChurchConnect: church website",
  "Stop by with a welcome gift and show the church website preview",
  "Drop off Laser church gifts for the welcome table",
  "Share the Live on Mission outreach idea with the pastor",
  "Call the pastor back and ask about their Sunday visitors",
  "Invite them to the Find a Church directory",
  "Visit after the midweek service and leave a card",
  "Ask how their outreach to neighbors is going",
  "Stop by and say hello to the office staff"
];

await step("EA r1: church filter drops every probe (normalized: look-alikes, full-width, spelled out, ads and campaigns)", () => {
  for (const text of CHURCH_MUST_DROP) {
    assert(core.cleanSuggestion("church", { next_step: text, app: "" }, card(), TODAY) === null, `next_step must drop: ${text}`);
    assert(core.cleanSuggestion("church", { next_step: "Stop by on Sunday", why: text, app: "churchconnect" }, card(), TODAY) === null, `why must drop: ${text}`);
  }
  assert(rule.normalizeOfferText("Op\u0435rate") === "operate" && rule.normalizeOfferText("\uFF2Darketing") === "marketing", "look-alike and full-width letters fold");
  assert(rule.normalizeOfferText("O-p-e-r-a-t-e") === "operate" && rule.normalizeOfferText("Group-Buy") === "group buy", "spelled out and hyphenated");
  assert(rule.hasForbiddenChurchWord("mark\u0435ting") && rule.hasForbiddenChurchWord("\uFF2Darketing"), "the shared marketing check normalizes too");
});

await step("EA r1: no promises (free, discount, % off, guarantee, deal, $ amount) for churches or businesses", () => {
  for (const text of PROMISES) {
    assert(core.cleanSuggestion("church", { next_step: text, app: "" }, card(), TODAY) === null, `church promise must drop: ${text}`);
    assert(core.cleanSuggestion("business", { next_step: text, app: "" }, business(), TODAY) === null, `business promise must drop: ${text}`);
  }
  const src = read("src/lib/engine/crm-suggest.ts");
  assert(src.includes("Never promise anything: no free things, discounts, prices, dollar amounts, deals, specific dates or guarantees."), "prompt rule against promises");
});

await step("EA r1: allowed church suggestions still pass (not over-blocking)", () => {
  for (const text of CHURCH_MUST_PASS) {
    const out = core.cleanSuggestion("church", { next_step: text, app: "easypeazy", when_days: 2, why: "They took a welcome card last visit." }, card(), TODAY);
    assert(out && out.nextStep === text, `must pass: ${text} → ${JSON.stringify(out)}`);
  }
});

await step("EA r1: business filter normalizes too; hidden campaign offer caught by any name", () => {
  for (const text of ["Pitch a Marketing-campaign", "Run a campaign for the grand opening", "Offer a mark\u0435ting campaign", "Run some ads", "Help with their SEO", "Pitch m-a-r-k-e-t-i-n-g c-a-m-p-a-i-g-n"]) {
    assert(core.cleanSuggestion("business", { next_step: text, app: "" }, business(), TODAY) === null, `business must drop while hidden: ${text}`);
  }
  const ok = core.cleanSuggestion("business", { next_step: "Drop off a Laser sample and ask about front-desk scheduling", app: "operate", when_days: 2 }, business(), TODAY);
  assert(ok && ok.appLabel === "Operate", "a plain business suggestion still passes");
});

await step("EA r1: already a customer → that app is not offered (signals on the card)", () => {
  const cc = card({ stops: [{ reason: "customer", text: "", app: "churchconnect" }] });
  assert(!core.allowedOffers("church", cc).some((o) => o.id === "churchconnect"), "ChurchConnect customer");
  const converted = card({ touches: [{ at: "2026-10-01T15:00:00Z", app: "churchconnect", kind: "customer", what: "Became a ChurchConnect customer", outreach: false, signal: true }] });
  assert(!core.allowedOffers("church", converted).some((o) => o.id === "churchconnect"), "customer touch counts");
  for (const app of ["easypeazy", "outreach", "messenger_avl"]) {
    assert(!core.allowedOffers("church", card({ stops: [{ reason: "customer", text: "", app }] })).some((o) => o.id === app), `${app} excluded once the card says so`);
  }
  for (const app of ["operate", "awd", "easypeazy", "laser"]) {
    assert(!core.allowedOffers("business", business({ stops: [{ reason: "customer", text: "", app }] })).some((o) => o.id === app), `business ${app} excluded once the card says so`);
  }
  assert(core.cleanSuggestion("church", { next_step: "Stop by", app: "churchconnect" }, cc, TODAY) === null, "picking an app they already buy drops it");
  const reg = read("source-of-truth/super-admin-registry.md");
  assert(reg.includes("**No signal yet** for EasyPeazy / church website, Outreach, Messenger AVL, Operate or AI Website Design"), "registry names the apps with no signal yet");
});

await step("unclear = church; businesses only get live business apps", () => {
  assert(core.suggestKind(card()) === "church", "church card");
  assert(core.suggestKind(card({ apps: ["laser"], churchId: null, org: null })) === "church", "Laser-only place is treated as a church");
  assert(core.suggestKind(business({ name: "Mt Zion Baptist Bakery" })) === "church", "church words win");
  assert(core.suggestKind(business()) === "business", "plain business lead");
  const ops = core.cleanSuggestion("business", { next_step: "Show the owner Operate", app: "operate", when_days: 1 }, business(), TODAY);
  assert(ops && ops.appLabel === "Operate", "Operate ok for a business");
  assert(core.cleanSuggestion("business", { next_step: "Pitch a campaign", app: "marketing_campaign" }, business(), TODAY) === null, "hidden Marketing campaign dropped");
  assert(core.cleanSuggestion("business", { next_step: "Offer a marketing campaign", app: "" }, business(), TODAY) === null, "hidden offer named in text dropped");
  assert(!core.allowedOffers("business", business()).some((o) => o.id === "marketing_campaign"), "not offered to the model either");
  assert(core.allowedOffers("church", card()).every((o) => ["churchconnect", "easypeazy", "laser", "outreach", "messenger_avl"].includes(o.id)), "church list = the rule");
});

await step("do-not-contact and rest: no outreach suggestion, at most 'Resting until'", () => {
  assert(core.suggestGate(card({ stops: [{ reason: "suppressed", text: "On the do-not-contact list." }] }), false).kind === "stopped", "suppressed");
  assert(core.suggestGate(card({ stops: [{ reason: "declined", text: "Asked not to be contacted." }] }), false).kind === "stopped", "declined");
  const rest = core.suggestGate(card({ repeat: { level: "hold", text: "", until: "2026-10-24T16:00:00Z" }, followUpReasons: ["wait"] }), false);
  assert(rest.kind === "resting" && rest.message === "Resting until Oct 24. Nothing is suggested until then.", JSON.stringify(rest));
  assert(core.suggestGate(card(), true).kind === "blocked", "unreadable list blocks");
  assert(core.suggestGate(card({ stops: [{ reason: "customer", text: "Already a Laser customer.", app: "laser" }] }), false).kind === "ok", "a customer can still get a suggestion");
  assert(!core.allowedOffers("church", card({ stops: [{ reason: "customer", text: "", app: "laser" }] })).some((o) => o.id === "laser"), "minus what they already buy");
});

// EA r2 re-probe: more promises, Unicode-dash phones, fewer false positives, more leaks closed.
const PROMISES_R2 = [
  "Bring a complimentary gift box",
  "Tell them the first box is on us",
  "Offer to waive the setup fee",
  "Mention the fee is waived this month",
  "Gift boxes are half price this week",
  "Gift boxes are half off",
  "Mention the 2-for-1 gift boxes",
  "Mention the two for one gift boxes",
  "Buy one get one on Laser gifts",
  "Mention the BOGO on gift boxes",
  "Offer the website gratis",
  "Mention there is no obligation",
  "Offer a free trial of the church website",
  "Offer a 30-day trial of ChurchConnect",
  "Mention the special offer",
  "It's a limited time offer",
  "Mention the rebate on gifts",
  "Gift boxes are 25 bucks",
  "Show them how to save money on gifts",
  "Show them how to save a lot of money",
  "Gift boxes are cheap",
  "Mention a deal on Laser gifts",
  "Offer a special deal",
  "They get a great deal on gift boxes"
];
const CHURCH_LEAKS_R2 = ["Introduce neighbor-ly", "Introduce neighbor ly", "Talk about an advert in the bulletin"];
const BUSINESS_DROPS_R2 = ["Talk about marketing", "Offer to promote the shop", "Offer to write Facebook posts", "Offer to boost your Google listing", "Help boost their Google listing"];
const CHURCH_PASS_R2 = [
  "Stop by the Free Will Baptist church office and leave a card",
  "Visit the Free Methodist church after Sunday service",
  "Thank them; they gave a great deal of help at the food drive",
  "Ask about the ad hoc welcome team",
  "Stop by the church on Market Street",
  "Say hello at their booth at the farmers market",
  "Congratulate the new youth leader who was promoted to pastor",
  "Use the free parking behind the church when you visit",
  "Leave the welcome gift by the free-standing sign",
  "Drop off Laser church gifts for the welcome table on 2026-10-20"
];

await step("EA r2: more promise words drop (churches and businesses)", () => {
  for (const text of PROMISES_R2) {
    assert(core.cleanSuggestion("church", { next_step: text, app: "" }, card(), TODAY) === null, `church promise must drop: ${text}`);
    assert(core.cleanSuggestion("business", { next_step: text, app: "" }, business(), TODAY) === null, `business promise must drop: ${text}`);
  }
});

await step("EA r2: church leaks closed; business drops bare marketing, promote, posts, Google listing while hidden", () => {
  for (const text of CHURCH_LEAKS_R2) assert(core.cleanSuggestion("church", { next_step: text, app: "" }, card(), TODAY) === null, `church must drop: ${text}`);
  for (const text of BUSINESS_DROPS_R2) assert(core.cleanSuggestion("business", { next_step: text, app: "" }, business(), TODAY) === null, `business must drop: ${text}`);
  // Safe phrases don't shield the rest of the sentence.
  for (const text of ["Visit the Free Will Baptist church with a free gift", "Stop by on Market Street and talk about marketing", "Ask about the ad hoc team and run some ads"]) {
    assert(core.cleanSuggestion("church", { next_step: text, app: "" }, card(), TODAY) === null, `still drops: ${text}`);
  }
  // Every earlier must-drop still drops with the narrower patterns.
  for (const text of [...CHURCH_MUST_DROP, ...PROMISES]) assert(core.cleanSuggestion("church", { next_step: text, app: "" }, card(), TODAY) === null, `earlier must-drop: ${text}`);
});

await step("EA r2: good church answers are not over-blocked", () => {
  for (const text of [...CHURCH_PASS_R2, ...CHURCH_MUST_PASS]) {
    const out = core.cleanSuggestion("church", { next_step: text, app: "laser", when_days: 2 }, card(), TODAY);
    assert(out && out.nextStep === text, `must pass: ${text} -> ${JSON.stringify(out)}`);
  }
});

await step("EA r2: output scrub — Unicode-dash and spaced phones, obfuscated emails gone; ISO dates kept", () => {
  const cases = [
    ["Call 912\u2011555\u20110101 to set a visit", "Call to set a visit"],
    ["Call 912\u2013555\u20130101 to set a visit", "Call to set a visit"],
    ["Call 912\u2212555\u22120101 to set a visit", "Call to set a visit"],
    ["Call \uFF19\uFF11\uFF12\uFF0D555\uFF0D0101 to set a visit", "Call to set a visit"],
    ["Call (912) 555 0101 to set a visit", "Call to set a visit"],
    ["Email office at grace dot org to set a visit", "Email to set a visit"],
    ["Email office(at)grace.org to set a visit", "Email to set a visit"],
    ["Email office [at] grace [dot] org to set a visit", "Email to set a visit"],
    ["Email office@grace.org to set a visit", "Email to set a visit"],
    ["Stop by on 2026-10-20 after lunch", "Stop by on 2026-10-20 after lunch"],
    ["Stop by on 2026-10-20 or call 912-555-0101", "Stop by on 2026-10-20 or call"]
  ];
  for (const [input, want] of cases) {
    const got = core.scrub(input);
    assert(got === want, `scrub(${JSON.stringify(input)}) = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
});

await step("EA r2: made-up names become a generic phrase (span replaced, suggestion kept)", () => {
  const cases = [
    ["Call Pastor James back next week", "Call the pastor back next week"],
    ["Pastor James Okafor said to come Sunday", "The pastor said to come Sunday"],
    ["Ask Rev. Okafor about the gift table", "Ask the pastor about the gift table"],
    ["Ask Reverend Mary-Ann Lee about the gift table", "Ask the pastor about the gift table"],
    ["Visit Brother Jerome after service", "Visit the member after service"],
    ["Visit Sister Mary Lou after service", "Visit the member after service"],
    ["Ask Mr Smith, Mrs. Jones and Ms Diaz", "Ask the contact, the contact and the contact"],
    ["Bring Dr. Okafor's gift box", "Bring the contact's gift box"],
    ["Thank Elder Brown and Deacon Wells", "Thank the elder and the deacon"],
    ["Visit Father Michael and Bishop T. Jakes", "Visit the priest and the bishop"],
    ["Ask the Pastor James about Sunday", "Ask the pastor about Sunday"],
    ["Bring a gift for Pastor Appreciation Sunday", "Bring a gift for Pastor Appreciation Sunday"],
    ["Call the pastor back", "Call the pastor back"]
  ];
  for (const [input, want] of cases) {
    const got = core.withoutMadeUpNames(input);
    assert(got === want, `names(${JSON.stringify(input)}) = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
  const out = core.cleanSuggestion("church", { next_step: "Call Pastor James back", why: "Sister Mary asked about gifts", app: "laser" }, card(), TODAY);
  assert(out && out.nextStep === "Call the pastor back" && out.why === "The member asked about gifts", JSON.stringify(out));
});

await step("EA r2: a filtered answer is not cached (a retry asks again and counts toward the cap)", async () => {
  process.env.XAI_API_KEY = "test-only-not-a-key";
  const prevCap = process.env.CRM_SUGGEST_DAILY_CAP;
  let calls = 0;
  const answers = [JSON.stringify({ next_step: "Offer a free gift", app: "" }), JSON.stringify({ next_step: "Stop by with a gift box", app: "laser", when_days: 1 })];
  const ask = async () => answers[Math.min(calls++, answers.length - 1)];
  const first = await server.suggestNextStep(card({ key: "church:retry" }), false, NOW, ask);
  const second = await server.suggestNextStep(card({ key: "church:retry" }), false, NOW, ask);
  const third = await server.suggestNextStep(card({ key: "church:retry" }), false, NOW, ask);
  assert(!first.ok && first.reason === "none" && second.ok && !second.cached && third.ok && third.cached && calls === 2, `retry: ${JSON.stringify({ first, second, third, calls })}`);
  // Retries count: with a cap already used up, a retry is refused without asking.
  process.env.CRM_SUGGEST_DAILY_CAP = "0";
  const capped = await server.suggestNextStep(card({ key: "church:capped" }), false, NOW, ask);
  assert(!capped.ok && capped.reason === "unavailable" && calls === 2, "cap still applies to retries");
  if (prevCap === undefined) delete process.env.CRM_SUGGEST_DAILY_CAP;
  else process.env.CRM_SUGGEST_DAILY_CAP = prevCap;
  delete process.env.XAI_API_KEY;
});

await step("EA r2: after Use this the button says Save until a type is picked", () => {
  const tools = read("src/components/engine/crm-church-tools.tsx");
  assert(tools.includes('kind === "drop_off" ? "Save drop-off" : kind === "visit" ? "Save visit" : "Save"'), "Save / Save visit / Save drop-off");
});

// EA r3 re-probe.
await step("EA r3: campaign carve-out gone; market carve-out only street/st/avenue/ave/road", () => {
  // "Campaign Street" passed in r2; EA r3 dropped that carve-out (street names never go to the model).
  const drops = ["Visit the church on Campaign Street", "Start a campaign drive", "Plan a campaign way bigger", "Set up a campaign place", "Run a campaign lane", "Meet at campaign square", "Meet at campaign plaza", "Stop by on Campaign Rd"];
  for (const text of drops) {
    assert(core.cleanSuggestion("church", { next_step: text, app: "" }, card(), TODAY) === null, `church must drop: ${text}`);
    assert(core.cleanSuggestion("business", { next_step: text, app: "" }, business(), TODAY) === null, `business must drop while hidden: ${text}`);
  }
  for (const text of ["Market Square fundraiser booth", "Talk about market plaza signs", "Stop by Market Drive marketing"]) {
    assert(core.cleanSuggestion("church", { next_step: text, app: "" }, card(), TODAY) === null, `church must drop (market outside the street carve-out): ${text}`);
  }
  for (const text of ["Stop by the church on Market Street", "Stop by the church on Market St.", "Visit the church on Market Avenue", "Visit the church on Market Ave", "Visit the church on Market Road", "Say hello at their booth at the farmers market"]) {
    const out = core.cleanSuggestion("church", { next_step: text, app: "" }, card(), TODAY);
    assert(out && out.nextStep === text, `must pass: ${text} -> ${JSON.stringify(out)}`);
  }
});

await step("EA r3: stacked titles and up to 3 name words; not-a-name words left alone", () => {
  const cases = [
    ["Ask Rev. Dr. Mary-Ann O\u2019Brien about the gift table", "Ask the pastor about the gift table"],
    ["Ask Rev. Dr. Mary-Ann O'Brien about the gift table", "Ask the pastor about the gift table"],
    ["Ask Rev Dr Mary-Ann O'Brien about the gift table", "Ask the pastor about the gift table"],
    ["Visit Sister Mary Lou Hart after service", "Visit the member after service"],
    ["Call Pastor Sam Q. Rivers back", "Call the pastor back"],
    ["Bring Dr. Okafor's gift box", "Bring the contact's gift box"],
    ["Ask the Deacon Board about a gift table", "Ask the Deacon Board about a gift table"],
    ["Stop by before the Elder Board meeting", "Stop by before the Elder Board meeting"],
    ["Mention their Sister Church in Macon", "Mention their Sister Church in Macon"],
    ["Visit Bishop Ministries downtown", "Visit Bishop Ministries downtown"],
    ["Bring gifts before Pastor Easter Sunday", "Bring gifts before Pastor Easter Sunday"],
    ["Drop off cards for the Pastor Christmas service", "Drop off cards for the Pastor Christmas service"]
  ];
  for (const [input, want] of cases) {
    const got = core.withoutMadeUpNames(input);
    assert(got === want, `names(${JSON.stringify(input)}) = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
  const out = core.cleanSuggestion("church", { next_step: "Ask Rev. Dr. Mary-Ann O'Brien about gifts", app: "laser" }, card(), TODAY);
  assert(out && out.nextStep === "Ask the pastor about gifts" && !/Mary|Brien/.test(out.nextStep), JSON.stringify(out));
});

await step("EA r3: more promise words drop", () => {
  const drops = ["Tell them they save 20% on gift boxes", "Tell them they save up to 30 percent", "Mention the 15% savings", "The first box is on the house", "Bring a freebie", "Bring some freebies", "Mention the giveaway", "Mention the low price on gift boxes", "Gift boxes are fifty bucks", "Gift boxes are twenty five bucks", "Gift boxes are twenty-five dollars", "It costs $ less than they think", "Offer gifts at cost"];
  for (const text of drops) {
    assert(core.cleanSuggestion("church", { next_step: text, app: "" }, card(), TODAY) === null, `church must drop: ${text}`);
    assert(core.cleanSuggestion("business", { next_step: text, app: "" }, business(), TODAY) === null, `business must drop: ${text}`);
  }
});

await step("EA r3: dates are not scrubbed as phones; phones still are", () => {
  const keep = ["Stop by on 10/20/2026 after lunch", "Stop by on 2026/10/20 after lunch", "Stop by on 20261020 after lunch", "Stop by on 2026-10-20 after lunch", "Stop by on 10-20-2026 after lunch"];
  for (const text of keep) assert(core.scrub(text) === text, `date kept: ${text} -> ${core.scrub(text)}`);
  assert(core.scrub("Stop by on 10/20/2026 or call (912) 555 0101") === "Stop by on 10/20/2026 or call", core.scrub("Stop by on 10/20/2026 or call (912) 555 0101"));
  for (const phone of ["9125550101", "912-555-0101", "912 555 0101", "(912) 555-0101", "+1 912 555 0101"]) {
    assert(core.scrub(`Call ${phone} today`) === "Call today", `phone ${phone}: ${core.scrub(`Call ${phone} today`)}`);
  }
});

await step("EA r3 (Lincoln's call): business drops Facebook posting, email blasts, newsletters, digital outreach while hidden", () => {
  for (const text of ["Offer to post on Facebook for them", "Offer an email blast", "Offer a monthly newsletter", "Pitch digital outreach"]) {
    assert(core.cleanSuggestion("business", { next_step: text, app: "" }, business(), TODAY) === null, `business must drop: ${text}`);
  }
  // Church-side Outreach (Live on Mission) is untouched by the business-only words.
  const lom = core.cleanSuggestion("church", { next_step: "Share the Live on Mission outreach idea", app: "outreach" }, card(), TODAY);
  assert(lom && lom.appId === "outreach", "church Outreach still passes");
});

// EA r4 re-probe.
await step("EA r4: the name capture stops at joining words, verbs and app names (the 7 EA cases)", () => {
  const cases = [
    ["Pastor Jim Will Visit", "The pastor Will Visit"],
    // Sue has no title but is clearly a second person: replaced too, so no name survives.
    ["Pastor Jim And Sue", "The pastor and another person"],
    ["Ask Pastor Jim If He Wants Laser", "Ask the pastor If He Wants Laser"],
    ["Thank Pastor Mike For The Welcome", "Thank the pastor For The Welcome"],
    ["Show Pastor Outreach", "Show Pastor Outreach"],
    ["Pastor ChurchConnect demo", "Pastor ChurchConnect demo"],
    ["Pastor Laser gift", "Pastor Laser gift"],
    // Two titled people stay two phrases; "and" before a title is not swallowed.
    ["Thank Elder Brown and Deacon Wells", "Thank the elder and the deacon"],
    ["Ask Pastor Jim and Sue Ellen Park about gifts", "Ask the pastor and another person about gifts"]
  ];
  for (const [input, want] of cases) {
    const got = core.withoutMadeUpNames(input);
    console.log(`     ${JSON.stringify(input)} -> ${JSON.stringify(got)}`);
    assert(got === want, `names(${JSON.stringify(input)}) = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
});

await step("EA r4: farmer's market (either apostrophe) passes", () => {
  for (const text of ["Say hello at their booth at the farmer's market", "Say hello at their booth at the farmer\u2019s market", "Say hello at their booth at the farmers' market"]) {
    const out = core.cleanSuggestion("church", { next_step: text, app: "" }, card(), TODAY);
    assert(out && out.nextStep === text, `must pass: ${text} -> ${JSON.stringify(out)}`);
  }
});

await step("EA r4: dates need a real month and day and can't run into more digits", () => {
  for (const text of ["Call 05-55-0101 today", "Call 5-55-0101 today", "Call 2026-10-20-0101 today"]) {
    assert(core.scrub(text) === "Call today", `not a date, scrubbed as a phone: ${text} -> ${core.scrub(text)}`);
  }
  for (const text of ["Stop by on 10/20/2026 after lunch", "Stop by on 2026/10/20 after lunch", "Stop by on 20261020 after lunch", "Stop by on 2026-10-20 after lunch", "Stop by on 1-5-2026 after lunch"]) {
    assert(core.scrub(text) === text, `date kept: ${text} -> ${core.scrub(text)}`);
  }
  assert(core.scrub("Stop by on 13/45/2026 after lunch") === "Stop by on after lunch", "month 13 / day 45 is not a date");
});

await step("EA r4: more promise words drop", () => {
  for (const text of ["Gift boxes for 5 grand", "A gift box costs only 99", "Each card is ninety-nine cents", "Gift boxes are priced low"]) {
    assert(core.cleanSuggestion("church", { next_step: text, app: "" }, card(), TODAY) === null, `church must drop: ${text}`);
    assert(core.cleanSuggestion("business", { next_step: text, app: "" }, business(), TODAY) === null, `business must drop: ${text}`);
  }
});

await step("minimal data: no name, contacts, emails, phones, visit notes, or the next step's words are sent", () => {
  const input = core.suggestInput(card(), "church", NOW);
  const text = JSON.stringify(input);
  for (const bad of ["Grace Fellowship", "Jane", "Sam", "Pastor", "@", "555", "Visit — met", "office@", "Secretary", "them"]) assert(!text.includes(bad), `sent ${bad}: ${text}`);
  // EA r1: exactly these fields; the next step goes as a kind from a fixed list plus its due date.
  assert(
    JSON.stringify(Object.keys(input).sort()) ===
      JSON.stringify(["allowed_apps", "apps_on_record", "apps_picked", "next_step_due", "next_step_type", "org_type", "recent_activity", "status", "today", "town"]),
    `fields: ${Object.keys(input)}`
  );
  assert(input.recent_activity.length === 2 && JSON.stringify(Object.keys(input.recent_activity[0]).sort()) === JSON.stringify(["by_us", "date", "they_responded", "type"]), "activity = type and date only");
  assert(input.next_step_type === "call" && input.next_step_due === "2026-10-17", `next step kind + due: ${input.next_step_type} ${input.next_step_due}`);
  const cases = {
    "Call Pastor Sam's cell 404.555.0199": "call",
    "Ask Brother Jerome (not saved) to text back": "call",
    "Email the office about Easter": "email",
    "Drop off a gift box": "drop_off",
    "Bring the Laser sample by": "drop_off",
    "Stop by after Sunday service": "visit",
    "Visit Rev. Okafor": "visit",
    "Follow up next week": "follow_up",
    "Check in with the secretary": "follow_up",
    "Think about it": "other",
    "": "none"
  };
  for (const [step, kind] of Object.entries(cases)) {
    assert(core.nextStepType(step) === kind, `${JSON.stringify(step)} → ${core.nextStepType(step)}, expected ${kind}`);
    // allowed_apps is the fixed app list (it says "gifts" on its own), so check everything else.
    const { allowed_apps: _apps, ...rest } = core.suggestInput(card({ nextStep: step }), "church", NOW);
    const sent = JSON.stringify(Object.values(rest)); // values only: field names like "next_step_due" are not the owner's words
    for (const word of step.split(/\s+/).filter((w) => w.length > 3 && !["visit", "call", "email", "drop", "follow"].includes(w.toLowerCase()))) {
      assert(!sent.includes(word), `next step word sent: ${word}`);
    }
  }
  assert(core.NEXT_STEP_TYPES.join(",") === "visit,call,email,drop_off,follow_up,other,none", "fixed list");
  const coreSrc = read("src/lib/engine/crm-suggest-core.ts");
  assert(!coreSrc.includes("withoutNames") && !coreSrc.includes("next_step: "), "name scrub code and raw next step removed");
  const reg = read("source-of-truth/super-admin-registry.md");
  assert(reg.includes("the next step's own words are never sent") && !reg.includes("saved people's names removed"), "registry data rule updated");
});

await step("server: stopped/resting never ask; no key → unavailable; bad answer → none; errors fail closed; cached per day", async () => {
  let asked = 0;
  const ask = (answer) => async () => {
    asked += 1;
    if (answer instanceof Error) throw answer;
    return answer;
  };
  delete process.env.XAI_API_KEY;
  const noKey = await server.suggestNextStep(card(), false, NOW, ask("{}"));
  assert(!noKey.ok && noKey.message === "Suggestions aren't available right now." && asked === 0, "no key: unavailable, not asked");
  process.env.XAI_API_KEY = "test-only-not-a-key";
  const stopped = await server.suggestNextStep(card({ stops: [{ reason: "suppressed", text: "" }] }), false, NOW, ask("{}"));
  const resting = await server.suggestNextStep(card({ repeat: { level: "hold", text: "", until: "2026-10-24T16:00:00Z" } }), false, NOW, ask("{}"));
  assert(!stopped.ok && !resting.ok && asked === 0, "stopped/resting: never asked");
  const operate = await server.suggestNextStep(card({ key: "church:op" }), false, NOW, ask(JSON.stringify({ next_step: "Sell them Operate", app: "operate" })));
  assert(!operate.ok && operate.reason === "none" && asked === 1, "Operate for a church: dropped end to end");
  const failed = await server.suggestNextStep(card({ key: "church:err" }), false, NOW, ask(new Error("timeout")));
  assert(!failed.ok && failed.message === "Suggestions aren't available right now.", "error: unavailable");
  const good = ask(JSON.stringify({ next_step: "Stop by with a gift box", app: "laser", when_days: 2 }));
  const first = await server.suggestNextStep(card({ key: "church:good" }), false, NOW, good);
  const again = await server.suggestNextStep(card({ key: "church:good" }), false, NOW, good);
  assert(first.ok && again.ok && again.cached && asked === 3, `cached: asked=${asked}`);
  delete process.env.XAI_API_KEY;
  const src = read("src/lib/engine/crm-suggest.ts");
  assert(src.includes("TIMEOUT_MS = 12_000") && src.includes("MAX_TOKENS = 300") && src.includes("CRM_SUGGEST_DAILY_CAP"), "timeout, token cap, daily cap");
  assert(src.includes('if (process.env.VERCEL_ENV || process.env.NODE_ENV !== "development") return null;'), "mock answer is local-dev only");
});

await step("owner only, server-side card", () => {
  const actions = read("src/app/(cockpit)/crm/actions.ts");
  const fn = actions.slice(actions.indexOf("export async function suggestNextStepAction"));
  assert(fn.indexOf("canAccessEngineOwner()") < fn.indexOf("loadCrmSnapshot()"), "owner check first");
  assert(fn.includes("snapshot?.cards.find((item) => item.key === key)") && fn.includes("snapshot.outreachHidden"), "card and DNC state read on the server");
  const ui = read("src/components/engine/crm-suggest.tsx");
  assert(ui.includes("if (!isOwner) return null;"), "UI owner only");
  // EA r1: a signed-out or non-owner ask gets the suggestion wording, not the save wording.
  assert(fn.includes("return refused(SUGGEST_OWNER_ONLY);") && actions.includes('const SUGGEST_OWNER_ONLY = "Only the owner can use this.";'), "signed-out message");
  // EA r1: server-only on both server modules.
  assert(read("src/lib/xai.ts").includes('import "server-only";') && read("src/lib/engine/crm-suggest.ts").includes('import "server-only";'), "server-only imports");
  assert(JSON.parse(read("package.json")).dependencies["server-only"], "server-only installed");
  // EA r1: Use this fills Next step and When only; what happened and the day stay for the owner.
  const tools = read("src/components/engine/crm-church-tools.tsx");
  assert(tools.includes('useState<"" | "visit" | "drop_off">(draft ? "" : "visit")') && tools.includes('defaultValue={draft ? "" : todayEastern()}'), "nothing preselected from a suggestion");
  assert(tools.includes('name="kind" value="visit" required') && tools.includes("Save only after you&apos;ve been there."), "kind required; hint shown");
  // VAD r1: resting hides the suggestion area completely, like stopped (no "Resting…" line).
  assert(ui.includes('if (suggestGate(card, outreachHidden).kind !== "ok") return null;') && !ui.includes("crm-suggest-rest"), "stopped, resting and blocked: no suggestion area");
  const page = read("src/app/(cockpit)/crm/page.tsx");
  assert(page.includes("isOwner={isOwner}"), "page passes the owner flag");
});

const VENDOR_RE = /\b(grok|xai|x\.ai|openai)\b/i;
await step("VAD r1: chips wrap, Next step grows, Go gently names the visit", () => {
  const css = read("src/app/styles.css");
  assert(css.includes(".crm-page .crm-offer-pills .crm-pill { max-width: 100%; min-width: 0; white-space: normal; overflow-wrap: anywhere;"), "app chips wrap within the card");
  const tools = read("src/components/engine/crm-church-tools.tsx");
  assert(tools.includes('<textarea\n      name="next_step"') && tools.includes("maxLength={200}") && tools.includes("box.scrollHeight"), "Next step is a growing textarea with the same name and limit");
  assert(!tools.includes('<input\n              name="next_step"'), "old one-line input gone");
  const coreSrc = read("src/lib/engine/lpl-crm-core.ts");
  assert(coreSrc.includes('last.kind === "visit"\n        ? `You visited ${agoText}.`'), "Go gently: You visited N days ago");
  assert(coreSrc.includes("? `You dropped something off ${agoText}.`"), "Go gently: You dropped something off N days ago");
});

await step("no vendor name on screen (client sources)", () => {
  for (const rel of ["src/components/engine/crm-suggest.tsx", "src/components/engine/crm-church-tools.tsx", "src/components/engine/crm-desk.tsx", "src/lib/engine/crm-suggest-core.ts", "src/app/(cockpit)/crm/page.tsx"]) {
    const code = ts.transpileModule(read(rel), { compilerOptions: { removeComments: true, jsx: ts.JsxEmit.Preserve } }).outputText;
    assert(!VENDOR_RE.test(code), `${rel} names the vendor`);
  }
  for (const rel of ["src/components/engine/crm-suggest.tsx", "src/components/engine/crm-desk.tsx", "src/components/engine/crm-church-tools.tsx"]) {
    assert(!/from "@\/lib\/xai"|from "@\/lib\/engine\/crm-suggest"/.test(read(rel)), `${rel} never imports the server helper`);
  }
});

await step("no vendor name in the browser bundle (when .next exists)", () => {
  const dir = path.join(repoRoot, ".next", "static");
  if (!fs.existsSync(dir)) {
    console.log("     (skipped: run after next build)");
    return;
  }
  const hits = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const full = path.join(d, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.(js|css|html|json)$/.test(name)) {
        const text = fs.readFileSync(full, "utf8");
        if (/api\.x\.ai|XAI_API_KEY|\bgrok\b|\bxAI\b/i.test(text)) hits.push(path.relative(repoRoot, full));
      }
    }
  };
  walk(dir);
  assert(hits.length === 0, `vendor text in: ${hits.join(", ")}`);
});

if (failed) {
  console.log(`\n${failed} suggestion check(s) failed.`);
  process.exit(1);
}
console.log("\nSuggestion smoke passed.");
