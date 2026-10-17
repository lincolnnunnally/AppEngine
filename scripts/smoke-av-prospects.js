// Messenger AVL kit: the church rule takes Messenger AVL (and its sound /
// video / lighting / livestream words pass every filter), and the AV prospect
// list is read only, scored on real cc_churches fields, nearest Vidalia first.
//   node scripts/smoke-av-prospects.js
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
const ruleUrl = toUrl(transpile("src/lib/engine/church-offer-rule.ts"));
const rule = await import(ruleUrl);
const core = await import(toUrl(transpile("src/lib/engine/crm-suggest-core.ts", { "./church-offer-rule": ruleUrl })));
const av = await import(toUrl(transpile("src/lib/engine/av-prospects-core.ts")));

const TODAY = "2026-10-17";
const card = (over = {}) => ({
  key: "church:c1",
  name: "Grace Fellowship",
  town: "Vidalia, GA",
  apps: ["churchconnect"],
  touches: [],
  repeat: { level: null, text: "" },
  stops: [],
  followUpReasons: ["due"],
  nextStep: "",
  nextActionDate: "",
  churchId: "c1",
  leadId: null,
  org: { kind: "church", id: "c1", name: "Grace Fellowship", city: "Vidalia", state: "GA", website: "", phone: "", email: "", offers: ["messenger_avl"] },
  contacts: [],
  recordPaths: {},
  possibleMatches: [],
  tokens: [],
  events: [],
  ...over
});

await step("Messenger AVL is on the church list and in the picker", () => {
  assert(rule.CHURCH_OFFER_IDS.includes("messenger_avl"), "on the list");
  assert(rule.offerChoices("church").some((c) => c.id === "messenger_avl" && c.label === "Messenger AVL (sound, video, lighting)"), "picker shows it");
  assert(!rule.offerChoices("business").some((c) => c.id === "messenger_avl"), "not a business choice");
  assert(JSON.stringify(rule.cleanChurchOfferIds(["messenger_avl", "operate", "messengeravl"])) === '["messenger_avl"]', "server keeps it once, drops Operate");
  assert(core.allowedOffers("church", card()).some((o) => o.id === "messenger_avl"), "offered to the suggestion model");
  assert(core.suggestInput(card(), "church", new Date("2026-10-17T16:00:00Z")).apps_picked.includes("Messenger AVL (sound, video, lighting)"), "picked label goes as a label");
});

await step("sound / video / lighting / livestream wording passes every church filter", () => {
  const good = [
    "Messenger AVL (sound, video, lighting)",
    "Ask if a sound and stream checkup on a Sunday would help",
    "Offer our partner Messenger AVL for the livestream setup",
    "Mention livestreaming on YouTube and Facebook Live",
    "Talk about sanctuary sound and lighting upgrades",
    "Projection, LED wall and camera help for the new building",
    "Sunday audio checkup with the tech team"
  ];
  for (const text of good) {
    assert(!rule.churchTextBlocked(text), `church filter: ${text}`);
    assert(!rule.promiseTextBlocked(text), `promise filter: ${text}`);
    assert(!rule.hasForbiddenChurchWord(text), `marketing word: ${text}`);
  }
  const ok = core.cleanSuggestion("church", { next_step: "Ask about a Sunday sound and stream checkup with our partner Messenger AVL", app: "messenger_avl", when_days: 2, why: "No livestream on file" }, card(), TODAY);
  assert(ok && ok.appId === "messenger_avl" && ok.appLabel === "Messenger AVL (sound, video, lighting)", "a Messenger AVL suggestion survives");
  assert(ok.nextStep.includes("Messenger AVL"), `name capture leaves Messenger AVL alone: ${ok.nextStep}`);
  const named = core.cleanSuggestion("church", { next_step: "Call Pastor Messenger AVL about sound", app: "messenger_avl", when_days: 1 }, card(), TODAY);
  assert(named && named.nextStep.includes("Messenger AVL"), `"Pastor Messenger AVL" is not read as a person: ${named && named.nextStep}`);
});

await step("the filters still bite with Messenger AVL in the text", () => {
  assert(core.cleanSuggestion("church", { next_step: "Offer a free sound checkup from Messenger AVL", app: "messenger_avl" }, card(), TODAY) === null, "a 'free' promise still drops it");
  assert(core.cleanSuggestion("church", { next_step: "Pitch Operate with Messenger AVL", app: "messenger_avl" }, card(), TODAY) === null, "Operate still drops it");
  assert(core.cleanSuggestion("church", { next_step: "Messenger AVL marketing for the livestream", app: "messenger_avl" }, card(), TODAY) === null, "marketing still drops it");
  assert(core.cleanSuggestion("church", { next_step: "Run YouTube ads for the stream", app: "messenger_avl" }, card(), TODAY) === null, "ads still drop it");
  assert(core.cleanSuggestion("church", { next_step: "Stop by", app: "messenger_avl" }, card({ stops: [{ reason: "customer", text: "", app: "messenger_avl" }] }), TODAY) === null, "already a customer drops it");
});

const none = () => false;
const row = (over = {}) => ({ id: "r1", name: "TEST CHURCH", city: "VIDALIA", state: "GA", lat: "32.2177", lng: "-82.4135", website: `https://${over.id || "r1"}.testchurch.example`, ...over });

await step("scoring uses only real fields and says 'on file'", () => {
  const site = av.scoreAvProspect(row());
  assert(site.score === 2 && site.reasons[0] === "Has a website, but no livestream or YouTube link on file", "website, no stream link");
  const fb = av.scoreAvProspect(row({ website: "", facebook_url: "https://facebook.com/x" }));
  assert(fb.score === 1 && /Facebook page on file/.test(fb.reasons[0]), "Facebook only");
  const streams = av.scoreAvProspect(row({ youtube_url: "https://youtube.com/@x" }));
  assert(streams.streams && streams.score < 1, "already streams");
  assert(av.websiteWeakness("https://tithe.ly/give_new/www/#/x") === "giving", "giving page");
  assert(av.websiteWeakness("http://www.churchangel.com/church/x.htm") === "directory", "directory listing");
  assert(av.websiteWeakness("https://x.wix.com/x") === "free_builder", "free builder");
  assert(av.websiteWeakness("http://www.nationalbaptist.com") === "denomination", "denomination site");
  assert(av.websiteWeakness("https://www.fbcvidalia.org/") === "", "own site is fine");
  const weak = av.scoreAvProspect(row({ website: "https://give.tithe.ly/?formId=1" }));
  assert(weak.score === 3 && weak.reasons.includes("The website on file is only a giving page"), "weak site adds a reason");
  const down = av.scoreAvProspect(row({ website_http_status: "404" }));
  assert(down.reasons.includes("Their website wasn't loading at our last check"), "not loading");
  const big = av.scoreAvProspect(row({ avg_attendance: "320", pastor_name: "A", contact_name: "B" }));
  assert(big.reasons.includes("About 320 attend (on file)") && big.reasons.includes("Several staff names on file"), "size hints");
  for (const r of [site, fb, weak, down, big]) for (const reason of r.reasons) assert(!/new building|growing/i.test(reason), "never claims a new building or growth");
});

await step("territory: central/South GA, rest of GA, Florida, South Carolina; nearest Vidalia inside each; cap 30", () => {
  assert(av.CENTRAL_SOUTH_GA_MAX_LAT === 33.25, "one documented line");
  assert(av.territoryTier("GA", 32.84) === 0 && av.territoryTier("Georgia", 33.08) === 0, "Macon, Milledgeville = central/South GA");
  assert(av.territoryTier("GA", 33.47) === 1 && av.territoryTier("GA", 33.75) === 1, "Augusta, Atlanta = rest of GA");
  assert(av.territoryTier("FL", 30.4) === 2 && av.territoryTier("Florida", 27) === 2, "Florida");
  assert(av.territoryTier("SC", 34) === 3 && av.territoryTier("South Carolina", 33) === 3, "South Carolina");
  assert(av.territoryTier("AL", 32) === null && av.territoryTier("GA", null) === null && av.territoryTier("", 32) === null, "outside / no location");
  const rows = [
    row({ id: "sc-near", name: "SC NEAR", state: "SC", lat: "32.4", lng: "-81.1" }),
    row({ id: "fl-near", name: "FL NEAR", state: "FL", lat: "30.4", lng: "-81.7" }),
    row({ id: "north-ga", name: "AUGUSTA CHURCH", city: "AUGUSTA", lat: "33.47", lng: "-82.01" }),
    row({ id: "far-strong", name: "VALDOSTA STRONG", city: "VALDOSTA", lat: "30.83", lng: "-83.28", website: "https://give.tithe.ly/x", avg_attendance: "400" }),
    row({ id: "near-weak", name: "NEAR WEAK", website: "", facebook_url: "https://facebook.com/a", lat: "32.25", lng: "-82.40" }),
    row({ id: "near-strong", name: "NEAR STRONG", lat: "32.30", lng: "-82.45", website: "https://x.weebly.com" }),
    row({ id: "dnc", name: "STOPPED", do_not_contact: "true" }),
    row({ id: "dnc-copy", name: "STOPPED COPY", lat: "32.218", lng: "-82.414", possible_same_as: ["dnc"] }),
    row({ id: "lost", name: "LOST", crm_status: "lost" }),
    row({ id: "merged", name: "MERGED", merged_into: "x" }),
    row({ id: "other", name: "TEMPLE", religion_guess: "other" }),
    row({ id: "qa", name: "QA", source: "qa_crm_v2" }),
    row({ id: "suppressed", name: "SUPPRESSED", website: "https://blocked.example" }),
    row({ id: "streams", name: "STREAMS", website: "https://streams.example", live_stream_url: "https://x" }),
    row({ id: "streams-copy", name: "STREAMS", website: "https://streams.example/", facebook_url: "https://facebook.com/s" }),
    row({ id: "client", name: "NEW LIFE CHURCH", city: "VIDALIA" }),
    row({ id: "client2", name: "WARREN BAPTIST CHURCH INC", city: "AUGUSTA", lat: "33.4735", lng: "-82.0105" }),
    row({ id: "assoc", name: "EMANUEL (SE)", prospect_kind: "association" }),
    row({ id: "twin", name: "NEAR STRONG CHURCH COPY", lat: "32.31", lng: "-82.45", website: "https://x.weebly.com/" }),
    row({ id: "al", name: "ALABAMA", state: "AL", lat: "32.4", lng: "-85.0" }),
    row({ id: "nolat", name: "NO LAT", lat: "", lng: "" }),
    row({ id: "near-strong", name: "DUPLICATE ID" })
  ];
  const blocked = (r) => String(r.website || "").includes("blocked.example");
  const list = av.rankAvProspects(rows, blocked);
  const ids = list.map((p) => p.churchId);
  assert(JSON.stringify(ids) === JSON.stringify(["near-weak", "near-strong", "far-strong", "north-ga", "fl-near", "sc-near"]), `order: ${ids.join(",")}`);
  assert(JSON.stringify(list.map((p) => p.tierLabel)) === JSON.stringify(["Central/South GA", "Central/South GA", "Central/South GA", "Rest of GA", "Florida", "South Carolina"]), "tier labels");
  assert(list.every((p) => p.reasons.length > 0 && p.reasons.every((r) => r.startsWith(`${p.tierLabel} \u00b7 `))), "every reason line starts with the tier");
  assert(!ids.includes("dnc-copy") && !ids.includes("streams-copy"), "a copy of a stopped / streaming church is left out too");
  assert(list[1].name === "Near Strong" && list[1].town === "Vidalia" && list[1].miles > 0, "tidy name, town, miles");
  assert(!("phone" in list[0]) && !("email" in list[0]), "no phone or email in the list");
  const many = Array.from({ length: 45 }, (_, i) => row({ id: `m${i}`, name: `CHURCH ${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`, lat: String(31 + i * 0.01), lng: "-82.4" }));
  assert(av.rankAvProspects(many, none).length === 30 && av.AV_LIST_SIZE === 30, "cap of 30");
  assert(av.rankAvProspects(rows, blocked, { size: 1 }).length === 1, "size option");
  const tidy = av.rankAvProspects([row({ id: "t1", name: "BETHEL AME CHURCH OF THE LORD", city: "EAST DUBLIN" })], none)[0];
  assert(tidy.name === "Bethel AME Church of the Lord" && tidy.town === "East Dublin", `tidy caps: ${tidy.name} / ${tidy.town}`);
  assert(av.milesFromVidalia(row()) < 0.1 && Math.abs(av.milesFromVidalia(row({ lat: "33.4735", lng: "-82.0105" })) - 89.5) < 2, "distance math");
});

await step("reads tier by tier in rings (jsonb number filters), never the whole table", () => {
  const f0 = av.tierRingFilters(0, 40);
  assert(f0.includes("doc->>state=in.(GA,Georgia)") && /doc->lat=lt\.33\.25|doc->lat=lte\.32\.79/.test(f0) && f0.includes("doc->lng=gte.-"), `tier 0 ring: ${f0}`);
  assert(av.tierRingFilters(0, 700).includes("doc->lat=lt.33.25"), "tier 0 stops at the line");
  assert(av.tierRingFilters(1, 700).includes("doc->lat=gte.33.25"), "tier 1 starts at the line");
  assert(av.tierRingFilters(2, 320).includes("doc->>state=in.(FL,Florida)") && av.tierRingFilters(3, 320).includes('doc->>state=in.(SC,"South Carolina")'), "FL and SC");
  assert(!/doc->>lat|doc->>lng/.test(av.tierRingFilters(0, 80)), "lat/lng compared as numbers (->), not text (->>)");
  for (const radius of av.AV_RINGS_MILES) {
    const box = av.ringBox(radius);
    // Every point on the circle is inside the box.
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const lat = av.VIDALIA.lat + (radius / 69) * Math.sin(rad) * 0.999;
      const lng = av.VIDALIA.lng + (radius / (69 * Math.cos((lat * Math.PI) / 180))) * Math.cos(rad) * 0.999;
      if (Math.abs(lat) < 89) assert(lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng, `ring ${radius} covers ${deg}°`);
    }
  }
  assert(av.AV_RINGS_MILES[av.AV_RINGS_MILES.length - 1] >= 600, "last ring covers the whole territory (Key West ~520 mi)");
  const loader = read("src/lib/engine/lpl-crm.ts");
  const body = loader.slice(loader.indexOf("export async function loadAvProspects"));
  assert(body.includes("tierRingFilters(tier, radius)") && body.includes("settled >= AV_LIST_SIZE"), "stops once the top is settled");
});

await step("read only, on tap, owner only, fail closed", () => {
  const loader = read("src/lib/engine/lpl-crm.ts");
  const body = loader.slice(loader.indexOf("export async function loadAvProspects"));
  assert(!/method:\s*"(POST|PATCH|PUT|DELETE)"/.test(body), "no writes");
  assert(body.includes('"outreach_suppressions"') && body.includes("couldn't be read, so no prospects are listed"), "do-not-contact list read first; unreadable → nothing");
  const actions = read("src/app/(cockpit)/crm/actions.ts");
  const act = actions.slice(actions.indexOf("export async function loadAvProspectsAction"));
  assert(/^export async function loadAvProspectsAction[^{]+\{\s*if \(!\(await canAccessEngineOwner\(\)\)\) return refused\(/.test(act), "owner gate first");
  const page = read("src/app/(cockpit)/crm/page.tsx");
  assert(!page.includes("loadAvProspects"), "never read on page load");
  const desk = read("src/components/engine/crm-desk.tsx");
  assert(/\{isOwner \? \(\s*<button[\s\S]*?AV prospects \(Messenger AVL\)/.test(desk), "chip shows for the owner only");
  for (const key of ["all", "today", "multi", "resting", "stops", "possible", "presence", "quiet"]) assert(desk.includes(`  ${key}: "`), `existing filter kept: ${key}`);
  const ui = read("src/components/engine/crm-av-prospects.tsx");
  assert(ui.includes('href={MESSENGER_AVL_URL}') && !/<img|logo/i.test(ui), "partner linked by name, no logo");
  assert(ui.includes("{item.tierLabel}") && ui.includes("33.25"), "tier shown on each row; the line is explained");
  assert(!/xai|grok|openai|anthropic|claude|gpt/i.test(ui + read("src/lib/engine/av-prospects-core.ts")), "no vendor names");
});

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall AV prospect checks passed");
