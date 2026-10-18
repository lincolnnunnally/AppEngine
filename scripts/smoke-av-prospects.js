// Messenger AVL kit: the church rule takes Messenger AVL (and its sound /
// video / lighting / livestream words pass every filter), and the AV prospect
// list is read only, scored on real cc_churches fields, nearest Vidalia first.
//   node scripts/smoke-av-prospects.js
import { createHash } from "node:crypto";
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
const crmCoreUrl = toUrl(transpile("src/lib/engine/lpl-crm-core.ts"));
const crm = await import(crmCoreUrl);
const nameUrl = toUrl(transpile("src/lib/engine/top-prospects-name.ts"));
const av = await import(toUrl(transpile("src/lib/engine/av-prospects-core.ts", { "@/lib/engine/lpl-crm-core": crmCoreUrl, "@/lib/engine/top-prospects-name": nameUrl })));
const names = await import(nameUrl);

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
  assert(rule.offerChoices("church").some((c) => c.id === "messenger_avl" && c.label === "Church sound, video & lighting"), "picker shows the service, not a vendor");
  assert(!rule.offerChoices("business").some((c) => c.id === "messenger_avl"), "not a business choice");
  assert(JSON.stringify(rule.cleanChurchOfferIds(["messenger_avl", "operate", "messengeravl"])) === '["messenger_avl"]', "server keeps it once, drops Operate");
  assert(core.allowedOffers("church", card()).some((o) => o.id === "messenger_avl"), "offered to the suggestion model");
  assert(core.suggestInput(card(), "church", new Date("2026-10-17T16:00:00Z")).apps_picked.includes("Church sound, video & lighting"), "picked label goes as a label");
});

await step("sound / video / lighting / livestream wording passes every church filter", () => {
  const good = [
    "Church sound, video & lighting",
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
  assert(ok && ok.appId === "messenger_avl" && ok.appLabel === "Church sound, video & lighting", "a sound, video and lighting suggestion survives");
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
  assert(fb.score === 1 && fb.reasons[0] === "Facebook page, but no livestream link on file", "Facebook page, but no livestream");
  const wrong = av.scoreAvProspect(row({ website: "https://savannahbaptist.example", city: "Vidalia", state: "GA" }));
  assert(wrong.reasons.includes("The website on file may be wrong") && !wrong.reasons.some((reason) => reason.startsWith("Has a website")), "a wrong-city site is an extra line, not counted as their website");
  const streams = av.scoreAvProspect(row({ youtube_url: "https://youtube.com/@x" }));
  assert(streams.streams && streams.score < 1, "already streams");
  assert(av.websiteWeakness("https://tithe.ly/give_new/www/#/x") === "giving", "giving page");
  assert(av.websiteWeakness("http://www.churchangel.com/church/x.htm") === "directory", "directory listing");
  assert(av.websiteWeakness("https://x.wix.com/x") === "free_builder", "free builder");
  assert(av.websiteWeakness("http://www.nationalbaptist.com") === "denomination", "denomination site");
  assert(av.websiteWeakness("https://www.fbcvidalia.org/") === "", "own site is fine");
  const weak = av.scoreAvProspect(row({ website: "https://give.tithe.ly/?formId=1" }));
  assert(weak.score === 1 && weak.reasons.includes("The website on file is only a giving page") && !weak.reasons.some((reason) => reason.startsWith("Has a website")), "a giving host is not counted as their website");
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
  assert(JSON.stringify(ids) === JSON.stringify(["near-weak", "near-strong", "twin", "far-strong", "north-ga", "fl-near", "sc-near"]), `order: ${ids.join(",")}`);
  assert(JSON.stringify(list.map((p) => p.tierLabel)) === JSON.stringify(["Central/South GA", "Central/South GA", "Central/South GA", "Central/South GA", "Rest of GA", "Florida", "South Carolina"]), "tier labels");
  assert(list.every((p) => p.reasons.length > 0 && p.reasons.every((r) => r.startsWith(`${p.tierLabel} \u00b7 `))), "every reason line starts with the tier");
  assert(av.avReasonText(list[0].reasons[0], list[0].tierLabel) === "Facebook page, but no livestream link on file", "the screen keeps the gap: Facebook page, but no livestream");
  assert(!av.avReasonText(list[0].reasons[0], list[0].tierLabel).includes("·"), "a bullet is the reason only");
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
  assert(body.includes("groupMateLookups") && body.includes("possible_same_as"), "also reads copies outside the ring, including ones with no website");
  assert(!body.includes("limit=5000") && body.includes("batch.length < DNC_PAGE"), "do-not-contact list is paged until it ends");
  assert(body.includes("cc_church_crm_activities") && body.includes("DONT_REPEAT_DAYS"), "visit and drop-off rests are read with the desk's window");
  assert(body.includes("consumeWideNameLookup") && body.includes('wide === "fail"') && body.includes("blockedIds: nameLookupBlocked"), "a wide name lookup blocks those churches or stops the list");
  assert(!/if \(batch\.length >= 40\) continue/.test(body), "a wide name lookup does not leave the church on the list");
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
  assert(/\{isOwner \? \(\s*<button[\s\S]*?AV prospects/.test(desk), "chip shows for the owner only");
  assert(!desk.includes("Messenger") && !/messengeravl\.com/i.test(desk), "the chip does not name a vendor");
  for (const key of ["all", "today", "multi", "resting", "stops", "possible", "presence", "quiet"]) assert(desk.includes(`  ${key}: "`), `existing filter kept: ${key}`);
  const ui = read("src/components/engine/crm-av-prospects.tsx");
  const visible = ui.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const rel of [
    "src/components/engine/crm-av-prospects.tsx",
    "src/lib/engine/church-offer-rule.ts",
    "src/lib/engine/av-prospects-core.ts",
    "source-of-truth/super-admin-registry.md"
  ]) assert(!/messengeravl\.com/i.test(read(rel)), `no partner link in ${rel}`);
  assert(!/messengeravl\.com|Messenger AVL|our partner/i.test(visible), "no vendor name, partner wording, or outbound link");
  assert(/your territory/i.test(visible) && !/Lincoln/.test(visible), "owner copy");
  assert(visible.includes("Up to 30 churches with a website or Facebook page, nearest first in each area. Leaves out churches that already stream, are resting or recently contacted, were invited, said no, were already won, are already being worked, are not public, are inactive, or are not a church."), "one footer line");
  assert(!visible.includes("33.25"), "the latitude line stays in comments");
  assert(visible.includes("subline(item)") && visible.includes("avReasonText"), "tier once in the subline; bullets are the reason");
  assert(visible.includes("Open in ChurchConnect") && !visible.includes("Open card"), "one action label");
  assert(visible.includes("crm-av-main") && visible.includes("crm-av-actions"), "text column and actions column");
  assert(!/<img|logo/i.test(ui), "no logo");
  assert(!/xai|grok|openai|anthropic|claude|gpt/i.test(ui + read("src/lib/engine/av-prospects-core.ts")), "no vendor names");
});

await step("name rules leave churches and drop other places", () => {
  const keep = [
    "First Baptist Church", "Temple Baptist Church", "Camp Creek Baptist Church", "College Park Baptist Church", "Grace Chapel",
    "Vidalia Baptist Temple", "Phillips Temple Ministries", "Healing Temple Ministries", "Faith Temple", "Allen Temple AME", "Bethel Temple",
    "Jehovah Jireh Church", "Jehovah Jireh Ministries", "Jehovah Nissi Worship Center", "College Place Methodist", "Seminary Hill Baptist",
    "Camp Creek Missionary Baptist", "Fellowship Association Church", "Mosque Street Baptist", "Baptist Seminary",
    "First Baptist Food Pantry",
    "West Ward Church of God", "Ward Grove Baptist", "Ward Chapel Baptist", "Ward Memorial UMC",
    "Foundation Church", "True Foundation COG", "New Foundation Holiness", "Faith Foundation COGIC", "Christ Foundation Ministries",
    "Baptist Foundation",
    "Christ Temple of Refuge", "Christ Deliverance Temple", "Macon Full Gospel Holy Temple", "Restoration Temple of Praise",
    "Calvary Apostolic Temple", "Baxley-Harvest Temple COG", "Sparks Temple COGIU", "Everette Temple CME", "Tremount Temple MBC", "Tremount Temple M.B.C",
    "Life UPC Richmond Hill campus", "Needwood Baptist Church and School", "Journey Church North Campus",
    "Old School (Primitive) Baptist Church", "Victory Academy of Praise Church", "Faith Baptist Christian Academy Church",
    "Trinity Pooler Church and Preschool",
    "The Living Word Christian Center", "Abundant Life Christian Center", "John Wesley Center",
    "Holsey Temple", "Hightower Memorial Temple", "James Temple", "Prayer Temple of Savannah",
    "Miracle Temple", "Miracle Healing Temple", "Eley's Healing Temple",
    "Solomon Temple", "Solomon's Temple International", "Temple of Truth",
    "Living Waters Temple", "New Greater Owens Temple", "Rhema Miracle Temple Outreach",
    "Temple of Higher Calling", "Victory Temple Bible Believers", "Bristol Temple"
  ];
  const drop = [
    "Kingdom Hall of Jehovah's Witnesses", "Kingdom-Hall", "KingdomHall", "Kingdom  Hall",
    "Bulloch County Islamic Center", "Masjid Al-Noor", "Muhammad Mosque", "Hindu Temple", "Buddhist Temple",
    "Beth Israel Synagogue", "Messianic Jewish Congregation", "The Church of Jesus Christ of Latter-day Saints", "LDS Chapel",
    "Vidalia Christian Academy", "Toombs Christian School", "Brewton-Parker College", "Pine Grove Cemetery", "Youth Camp",
    "Unitarian Fellowship", "Universalist Society", "Episcopal Diocese of Georgia", "Catholic Diocese",
    "Georgia Conference Center", "Church Retreat Center", "Food Distribution Center",
    "Community Food Bank", "Community Food Pantry", "Masjed Noor", "Musalla", "Stake Center", "First Ward", "1st Ward", "3rd Ward", "Mormon Chapel",
    "Sikh Temple", "Gurdwara", "Baha'i Center", "Bahá'í Center", "Hindu Mandir", "Beth Israel", "Congregation Beth Israel",
    "Christian Science Church", "Church of Scientology", "Spiritualist Church", "Jehovah",
    "Queen of Victory MBA", "Emanuel MBA", "Zion MBA", "Mt Vernon BA", "Altamaha–New Sunbury BA", "Second Washington BA",
    "Georgia Union Missionary Association", "Union Baptist Association of Churches", "Holiness Baptist Association Campgrounds",
    "Emanuel Baptist Association", "Bible Baptist Christian Academy", "Faith Baptist Christian Academy",
    "Christian Life School of Ministry", "Episcopal Campus Ministry", "Kudzu College Ministry", "First Church of Christ, Scientist",
    "First Baptist Preschool", "First Baptist Preschool Gray", "First Baptist Preschool Gray Ga",
    "Kingdom Kids", "South Georgia Conference Council", "Faith Temple Outreach Community Center",
    "Swaminarayan Temple", "Temple Beth El", "Hindu Shrine",
    "Fitzgerald Hebrew Congregation", "Waycross Hebrew Center", "Temple Mickve Israel", "Chabad of Savannah", "B'nai B'rith", "Bnai Brith",
    "Southwest District UMC", "Macon East District AMEC", "Children's Home", "Children's Homes"
  ];
  for (const name of keep) assert(!av.avNameExcluded(name), `keep ${name}`);
  for (const name of drop) assert(av.avNameExcluded(name), `drop ${name}`);
  console.log(`     name fixtures: ${keep.length} kept, ${drop.length} dropped`);
  const temple = av.rankAvProspects([row({ id: "temple", name: "TEMPLE BAPTIST CHURCH" })], none);
  assert(temple.length === 1 && temple[0].name === "Temple Baptist Church", "Temple Baptist Church can be listed");
});

await step("duplicate copies and stopped rows stay off the list (probe)", () => {
  const base = { state: "GA", lat: "32.22", lng: "-82.41", website: "", facebook_url: "https://facebook.com/x" };
  const r = (over) => ({ ...base, ...over });
  const ids = (rows) => av.rankAvProspects(rows, none).map((item) => item.churchId);
  assert(JSON.stringify(ids([
    r({ id: "A", name: "Alpha", city: "Vidalia", website: "https://x.org", lat: "32.2177" }),
    r({ id: "B", name: "Grace Church", city: "Vidalia", website: "https://b.org", lat: "32.2178" }),
    r({ id: "C", name: "Grace Church", city: "Vidalia", website: "https://x.org", do_not_contact: true, lat: "32.219" })
  ])) === JSON.stringify(["A"]), "a shared host does not bridge two different names; the same name still drops");
  assert(ids([
    r({ id: "A", name: "Connection Church", city: "Vidalia", website: "https://ccvidalia.com/", do_not_contact: true }),
    r({ id: "B", name: "Connection Church", city: "Vidalia", website: "https://ccvidalia.com/about-us/children" })
  ]).length === 0, "same host and town, different path");
  assert(ids([
    r({ id: "A", name: "Connection Church", city: "Vidalia", website: "https://ccvidalia.com/" }),
    r({ id: "B", name: "Konnection Kids", city: "Vidalia", website: "https://ccvidalia.com/about" })
  ]).length === 2, "a host shared by two names is not one church");
  assert(ids([
    r({ id: "A", name: "BULLOCH COUNTY ISLAMIC CENTER INC", city: "STATESBORO", do_not_contact: true }),
    r({ id: "B", name: "Bulloch County Islamic Center", city: "Statesboro" })
  ]).length === 0, "Inc suffix and non-church name");
  assert(churchSame(av, "http://www.foo.org/", "https://foo.org"), "www and scheme do not make a new site");
  assert(ids([
    r({ id: "A", name: "Grace Church", city: "Vidalia", website: "http://www.foo.org/", do_not_contact: true }),
    r({ id: "B", name: "Grace Church", city: "Vidalia", website: "https://foo.org" })
  ]).length === 0, "www vs bare host");
  assert(JSON.stringify(ids([
    r({ id: "A", name: "Grace Church", city: "Vidalia", website: "https://foo.org", do_not_contact: true }),
    r({ id: "B", name: "Grace Church", city: "Lyons", website: "https://foo.org" })
  ])) === JSON.stringify(["B"]), "a website match stays inside one town");
  assert(av.churchNameKey("St Paul AME") === av.churchNameKey("Saint Paul AME"), "St and Saint match");
  assert(ids([
    r({ id: "A", name: "St Paul AME", city: "Vidalia", do_not_contact: true }),
    r({ id: "B", name: "Saint Paul AME", city: "Vidalia" })
  ]).length === 0, "St vs Saint");
  for (const rows of [
    [r({ id: "B", name: "Beta", city: "Vidalia", possible_same_as: ["A"], lat: "32.2177" }), r({ id: "A", name: "Alpha2", city: "Lyons", do_not_contact: true, lat: "32.25" })],
    [r({ id: "A", name: "Alpha2", city: "Lyons", do_not_contact: true, possible_same_as: ["B"], lat: "32.2177" }), r({ id: "B", name: "Beta", city: "Vidalia", lat: "32.25" })],
    [r({ id: "B", name: "Beta", city: "Vidalia", lat: "32.2177" }), r({ id: "A", name: "Alpha2", city: "Lyons", do_not_contact: true, possible_same_as: ["B"], lat: "32.25" })]
  ]) assert(ids(rows).length === 0, "possible_same_as either way");
  assert(ids([
    r({ id: "A", name: "Kingdom Hall", city: "Vidalia", website: "http://www.watchtower.org" }),
    r({ id: "B", name: "Kingdom Hall", city: "Lyons", website: "http://www.watchtower.org" })
  ]).length === 0, "a denomination host is not one church, and Kingdom Hall is not listed");
  assert(JSON.stringify(ids([
    r({ id: "A", name: "First Baptist Church", city: "Vidalia", website: "https://a.org", do_not_contact: true }),
    r({ id: "B", name: "Baptist Church First", city: "Vidalia", website: "https://b.org" })
  ])) === JSON.stringify(["B"]), "word order does not merge two churches");
  assert(ids([r({ id: "A", name: "A1", city: "Vidalia", do_not_contact: "yes" }), r({ id: "B", name: "B1", city: "Vidalia", do_not_contact: "1" })]).length === 0, "yes and 1 are do-not-contact");
  assert(ids([r({ id: "A", name: "A1", city: "Vidalia", active: "false", is_public: "false" })]).length === 0, "inactive");
  assert(ids([
    r({ id: "A", name: "A1", city: "Vidalia", crm_status: "not_interested" }),
    r({ id: "B", name: "B1", city: "Vidalia", crm_status: "declined" })
  ]).length === 0, "stopped pipeline statuses");
  assert(ids([r({ id: "A", name: "Invited Church", city: "Vidalia", invite_status: "sent" })]).length === 0, "already invited");
  const lookups = av.groupMateLookups([r({ id: "B", name: "Saint Paul AME", city: "Vidalia", possible_same_as: ["A"] })]);
  assert(lookups.ids.includes("A") && lookups.nameCities.some((item) => item.city === "Vidalia" && item.pattern.includes("saint")), "loader asks for the missing copy");
  const named = av.groupMateLookups([
    r({ id: "wide", name: "First Baptist", city: "Vidalia" }),
    r({ id: "copy", name: "First Baptist Church", city: "Vidalia" }),
    r({ id: "other", name: "Grace Chapel", city: "Lyons" })
  ]);
  const first = named.nameCities.find((item) => item.pattern === "first baptist");
  assert(first && first.churchIds.includes("wide") && first.churchIds.includes("copy") && !first.churchIds.includes("other"), "a wide lookup knows which church it belongs to");
  const group = new Set();
  assert(av.consumeWideNameLookup(40, first.churchIds, group) === "block" && group.has("wide") && group.has("copy"), "a lookup of 40 blocks every church in that group");
  assert(av.consumeWideNameLookup(39, first.churchIds, new Set()) === "use", "a lookup under 40 is used");
  const missing = new Set();
  assert(av.consumeWideNameLookup(40, [], missing) === "fail" && missing.size === 0, "40 rows and no church id fails the list closed");
  assert(av.rankAvProspects([
    r({ id: "wide", name: "First Baptist Church", city: "Vidalia" }),
    r({ id: "copy", name: "First Baptist", city: "Vidalia" }),
    r({ id: "other", name: "Grace Chapel", city: "Lyons" })
  ], none, { blockedIds: group }).map((item) => item.churchId).join(",") === "other", "a too-wide name lookup blocks that church and its group");
});

await step("desk names, shared sites, rests, and the churches that must come back", () => {
  assert(av.churchNameKey("Smith Street Baptist", "Vidalia") === av.churchNameKey("SMITH STREET BAPTIST CHURCH", "Vidalia"), "trailing church");
  assert(av.churchNameKey("North Thompson Baptist") === av.churchNameKey("NORTH THOMPSON BAPTIST CHURCH INC"), "trailing church and inc");
  assert(av.churchNameKey("Christian Methodist Episcopal") === av.churchNameKey("CHRISTIAN METHODIST EPISCOPAL CHURCH"), "episcopal without a trailing church");
  assert(av.churchNameKey("Mt Zion Baptist") === av.churchNameKey("Mount Zion Baptist Church"), "Mt and Mount");
  assert(av.churchNameKey("St. Paul A.M.E.") === av.churchNameKey("Saint Paul AME"), "St. and A.M.E.");
  assert(av.churchNameKey("The First Baptist Church of Vidalia", "Vidalia") === av.churchNameKey("First Baptist", "Vidalia"), "leading The and of the town");
  const base = { state: "GA", lat: "32.22", lng: "-82.41", website: "", facebook_url: "https://facebook.com/x" };
  const r = (over) => ({ ...base, ...over });
  const ids = (rows, now) => av.rankAvProspects(rows, none, now ? { now } : {}).map((item) => item.churchId);
  assert(ids([
    r({ id: "desk", name: "Smith Street Baptist", city: "Vidalia" }),
    r({ id: "dir", name: "SMITH STREET BAPTIST CHURCH", city: "Vidalia", do_not_contact: true })
  ]).length === 0, "desk name groups with the directory name in the same town");
  assert(ids([
    r({ id: "desk", name: "North Thompson Baptist", city: "Vidalia" }),
    r({ id: "dir", name: "NORTH THOMPSON BAPTIST CHURCH INC", city: "VIDALIA", do_not_contact: true })
  ]).length === 0, "church inc groups with the desk name");
  const back = av.rankAvProspects([
    r({ id: "sop", name: "SOPERTON CHURCH OF GOD", city: "SOPERTON", website: "https://churchofgod.org/soperton", facebook_url: "" }),
    r({ id: "snow", name: "SNOWHILL CHURCH OF GOD", city: "SNOWHILL", website: "https://churchofgod.cc", facebook_url: "" }),
    r({ id: "hill", name: "HILLSIDE CHURCH OF GOD", city: "VIDALIA", website: "https://www.churchofgod.org", facebook_url: "" }),
    r({ id: "ailey", name: "AILEY UMC", city: "AILEY", website: "https://sgaumc.org/ailey", facebook_url: "" }),
    r({ id: "sumc", name: "SOPERTON UMC", city: "SOPERTON", website: "https://sgaumc.org/soperton", facebook_url: "" }),
    r({ id: "alta", name: "ALTAMAHA BAPTIST", city: "VIDALIA", website: "https://altamahabaptist.example", facebook_url: "" })
  ], none);
  assert(JSON.stringify(back.map((item) => item.churchId).sort()) === JSON.stringify(["ailey", "alta", "hill", "snow", "sop", "sumc"]), `churches come back: ${back.map((item) => item.churchId).join(",")}`);
  assert(back.find((item) => item.churchId === "alta").reasons.some((reason) => reason.includes("Has a website, but no livestream or YouTube link on file")), "Altamaha keeps the gap");
  assert(back.filter((item) => item.churchId !== "alta").every((item) => item.reasons.length === 1 && /denomination/.test(item.reasons[0])), "a denomination site is the only reason");
  const now = new Date("2026-10-17T15:00:00.000Z");
  assert(av.avDeskBlocked({ desk_touches: [{ at: "2026-10-10T15:00:00.000Z", kind: "visit", outreach: true }] }, now), "a visit inside 14 days rests");
  assert(!av.avDeskBlocked({ desk_touches: [{ at: "2026-09-01T15:00:00.000Z", kind: "visit", outreach: true }] }, now), "a visit older than 14 days does not rest");
  assert(av.avDeskBlocked({ desk_touches: [{ at: "2026-10-14T15:00:00.000Z", kind: "drop_off", outreach: true }] }, now), "a drop-off inside 7 days rests");
  assert(!av.avDeskBlocked({ desk_touches: [{ at: "2026-10-01T15:00:00.000Z", kind: "drop_off", outreach: true }] }, now), "a drop-off older than 7 days does not rest");
  assert(ids([r({ id: "rest", name: "Rested Church", city: "Vidalia", desk_touches: [{ at: "2026-10-10T15:00:00.000Z", kind: "visit", outreach: true }] })], now).length === 0, "a resting church stays off the list");
  assert(!av.websitePlaceMismatch("https://newbirthsavannah.org", "Pooler", "GA", "New Birth Savannah"), "Savannah in the name is not the wrong city");
  assert(!av.websitePlaceMismatch("https://savannahchristian.org", "Savannah", "GA", "Savannah Christian Church"), "Savannah Christian is in Savannah");
  assert(!av.websitePlaceMismatch("https://savannahriverbaptist.org", "Sylvania", "GA", "Savannah River Baptist"), "Savannah River is their name");
  assert(!av.websitePlaceMismatch("https://poolersavannah.example", "Pooler", "GA", "New Hope"), "Pooler is in the Savannah area");
  const dallas = av.scoreAvProspect(r({ id: "dal", name: "First Baptist", city: "Vidalia", state: "GA", website: "https://dallasfirst.org", facebook_url: "" }));
  assert(dallas.reasons.includes("The website on file may be wrong") && !dallas.reasons.some((reason) => reason.startsWith("Has a website")), "dallas is another city's site");
  const nashville = av.scoreAvProspect(r({ id: "nash", name: "Grace", city: "Vidalia", state: "GA", website: "https://nashvillegrace.org", facebook_url: "" }));
  assert(nashville.reasons.includes("The website on file may be wrong"), "nashville is another city's site");
  const texas = av.scoreAvProspect(r({ id: "tx", name: "Grace", city: "Vidalia", state: "GA", website: "https://gracechurchtexas.org", facebook_url: "" }));
  assert(texas.reasons.includes("The website on file may be wrong"), "texas is another state");
  const generic = ["subsplash.com", "google.com", "goo.gl", "business.site", "squarespace.com", "ourchurch.com", "ministrybrands.com", "churchofgod.cc", "chamberofcommerce.com", "sgaumc.org", "bizapedia.com", "churchofgod.org", "giv.li", "netministries.org", "nazarene.org", "paypal.com", "cash.app"];
  for (const host of generic) assert(av.websiteWeakness(`https://${host}/x`) !== "", `${host} is generic`);
  const only = av.scoreAvProspect(r({ id: "gen", name: "Grace", city: "Vidalia", website: "https://sgaumc.org/grace", facebook_url: "https://facebook.com/grace" }));
  assert(only.reasons.length === 1 && only.reasons[0].includes("denomination"), "a denomination site does not also say Facebook or has a website");
});

await step("top prospects: ZIP3 territory, score, won, rest, twins, names", () => {
  assert(JSON.stringify(av.CENTRAL_SOUTH_GA_ZIP3) === JSON.stringify(["304", "310", "312", "313", "314", "315", "316", "317", "318", "319", "398"]), "ZIP3 list");
  assert(av.TOP_LIST_SIZE === 25, "top list is 25");
  assert(av.topTerritoryTier("GA", "31024") === 0, "top list: Eatonton 31024 is central/South GA even north of the latitude line");
  assert(av.topTerritoryTier("GA", "30240") === 1, "top list: LaGrange 30240 is the rest of GA even south of the latitude line");
  assert(av.territoryTier("GA", 33.32) === 1 && av.territoryTier("GA", 33.04) === 0, "AV list uses the latitude line");
  assert(av.territoryTier("GA", 32.84) === 0 && av.territoryTier("GA", 33.47) === 1, "AV list: Macon is central/South GA and Augusta is the rest");
  assert(av.territoryTier("FL", null) === null && av.territoryTier("SC", null) === null && av.territoryTier("GA", null) === null, "AV list requires a latitude");
  assert(av.topTerritoryTier("GA", "") === 1 && av.topTerritoryTier("GA", "30301") === 1, "top list is ZIP3 only; a missing ZIP is rest of GA");
  assert(av.FIT_POINTS.medium === 20, "bare medium fit is 20");
  assert(av.topTerritoryTier("GA", "31024-1234") === 0, "top list ZIP+4");
  assert(av.FIT_POINTS.high === 30 && av.FIT_POINTS["medium (no website)"] === 20 && av.FIT_POINTS["possible (website unreachable)"] === 15 && av.FIT_POINTS["possible (website on record looks wrong)"] === 10 && av.FIT_POINTS.low === 0, "fit weights");
  assert(av.fitPointsOf("nope") === 0, "unknown fit is 0");
  const base = { state: "GA", city: "Vidalia", lat: "32.22", lng: "-82.41", zip_code: "30474", website: "https://one.example" };
  const signals = (score, fit, extra = {}) => ({ av_score: score, churchconnect_fit: fit, av_reasons: ["livestreams (youtube)", "streamed recently (2026-10-11)"], ...extra });
  const streaming = { ...base, id: "s1", name: "Stream Chapel", youtube_url: "https://youtube.com/@s", av_signals: signals(40, "high") };
  assert(av.avExcluded(streaming, none, new Date("2026-10-17T15:00:00.000Z")) === false, "AV list matches #416: a stream link is not an avExcluded drop");
  assert(av.rankAvProspects([streaming], none).length === 0, "AV list leaves the streaming church out");
  const hiddenFlag = { ...base, id: "hid-flag", name: "Hidden Flag Chapel", hidden: true, website: "https://hidden-flag.example" };
  const isHiddenFlag = { ...base, id: "is-hid", name: "Is Hidden Chapel", is_hidden: true, website: "https://is-hidden.example" };
  const notPublic = { ...base, id: "priv", name: "Private Chapel", is_public: false, website: "https://private.example" };
  assert(av.avExcluded(hiddenFlag, none) === false && av.avExcluded(isHiddenFlag, none) === false, "AV list keeps hidden and is_hidden rows");
  assert(av.avExcluded(notPublic, none) === true, "AV list still drops is_public false");
  const topStream = av.rankTopProspects([streaming], none, { tier: 0, now: new Date("2026-10-17T15:00:00.000Z") });
  assert(topStream.open.length === 1 && topStream.open[0].churchId === "s1", "top list keeps the streaming church");
  assert(topStream.open[0].score === 70 && topStream.open[0].reason.startsWith("Has a website"), `score and fit phrase: ${topStream.open[0].score} ${topStream.open[0].reason}`);
  assert(topStream.open[0].reason.length <= 90, "reason stays within 90 characters");
  const mismatch = { ...base, id: "bad", name: "Mismatch Chapel", av_signals: signals(99, "high", { website_match: "mismatch" }) };
  const rejected = { ...base, id: "rej", name: "Rejected Chapel", website: "https://rej.example", av_signals: signals(99, "high", { website_match: "rejected" }) };
  assert(av.rankTopProspects([mismatch, rejected, streaming], none, { tier: 0 }).open.map((item) => item.churchId).join(",") === "s1", "mismatch and rejected websites are left out");
  const now = new Date("2026-10-17T15:00:00.000Z");
  const resting = { ...base, id: "rest", name: "Resting Chapel", website: "https://rest.example", desk_touches: [{ at: "2026-10-10T15:00:00.000Z", kind: "visit", outreach: true }], av_signals: signals(10, "high") };
  const rested = av.rankTopProspects([resting], none, { tier: 0, now });
  assert(rested.open.length === 1 && rested.open[0].status === "Resting" && rested.open[0].restLabel === "Resting until Oct 24", `resting tagged: ${rested.open[0] && rested.open[0].status} ${rested.open[0] && rested.open[0].restLabel}`);
  assert(av.rankAvProspects([resting], none, { now }).length === 0, "AV mode still leaves a resting church off");
  const won = { ...base, id: "won", name: "Won Chapel", website: "https://won.example", is_customer: true, converted_at: "2026-10-02T15:00:00.000Z", av_signals: signals(100, "high") };
  const many = [won, ...Array.from({ length: 26 }, (_, index) => ({ ...base, id: `n${index}`, name: `Chapel ${String(index).padStart(2, "0")}`, website: `https://n${index}.example`, zip_code: "30474", av_signals: signals(80 - index, "low") }))];
  const filled = av.rankTopProspects(many, none, { tier: 0, now });
  assert(filled.won.map((item) => item.churchId).join(",") === "won" && filled.won[0].wonAt === "Oct 2", `won strip: ${filled.won.map((item) => item.churchId).join(",")} ${filled.won[0] && filled.won[0].wonAt}`);
  assert(filled.open.length === 25 && filled.open[0].churchId === "n0" && filled.open[24].churchId === "n24" && !filled.open.some((item) => item.churchId === "n25"), `number 26 fills in: ${filled.open.map((item) => item.churchId).join(",")}`);
  const hidden = { ...base, id: "hid", name: "Hidden Twin", is_public: false, website: "https://twin.example", av_signals: signals(44, "high") };
  const visible = { ...base, id: "vis", name: "Visible Twin", website: "https://twin.example", possible_same_as: ["hid"] };
  const twins = av.rankTopProspects([hidden, visible], none, { tier: 0, now });
  assert(twins.open.length === 1 && twins.open[0].churchId === "vis" && twins.open[0].score === 74 && twins.open[0].reason.includes("scored on a duplicate record"), `twin carry-over: ${twins.open.map((item) => `${item.churchId}:${item.score}:${item.reason}`).join(" | ")}`);
  const dropName = (name, row) => assert(names.topNameExcluded(name, row), `drop ${name}`);
  const keepName = (name, row) => assert(!names.topNameExcluded(name, row), `keep ${name}`);
  dropName("ST MARKS ENDOWMENT TR");
  dropName("Community Trust");
  keepName("College Place Methodist");
  keepName("College Place Presbyterian");
  dropName("South Georgia Conference");
  dropName("Grace Mission Inc");
  dropName("SOUTH AMERICAN MISSION INC");
  keepName("SOUTH AMERICAN MISSION INC", { ntee: "X20" });
  dropName("SOUTH AMERICAN MISSION INC", { ntee: "X99" });
  dropName("Harvest Fields");
  dropName("Fields Chapel");
  dropName("South Georgia District");
  dropName("Valley Retreat");
  dropName("Clay Hill Christian Retreat", { ntee: "X20" });
  keepName("Retreat Baptist Church");
  keepName("The District Church");
  dropName("Messianic Jewish Congregation");
  dropName("Spring Valley Presbyterian Church Soccer Fields");
  dropName("Spring Valley Soccer Fields");
  dropName("City Soccer Complex");
  dropName("Athletic Park");
  dropName("Pine Park");
  keepName("Parish Church of St Martins in the Fields");
  keepName("First Baptist Church of Lake Park");
  keepName("First Baptist Church Park");
  keepName("Grace Church Gym");
  keepName("Hope Church Complex");
  keepName("Church Retreat Center");
  keepName("St Martin in the Fields Episcopal Church");
  dropName("Pittman Park");
  keepName("Pittman Park", { denomination: "United Methodist" });
  dropName("Labor of the Field");
  keepName("LABOR OF THE FIELD", { ntee: "X21", ein: "272889005" });
  keepName("Knowles Chapel Cemetery", { denomination: "Global Methodist" });
  keepName("Morgan Baptist Church Cemetery", { denomination: "Southern Baptist Convention" });
  dropName("Old Church Cemetery");
  dropName("Old Church Cemetery", { ntee: "X30" });
  keepName("Foundation Baptist Church");
  keepName("Foundation Church");
  keepName("New Foundation Holiness Church");
  keepName("Spiritual Foundation Ministries");
  keepName("CHRIST FOUNDATION MINISTRIES");
  dropName("FIRST BAPTIST CHURCH FOUNDATION");
  dropName("FIRST BAPTIST CHURCH FOUNDATION", { denomination: "Baptist" });
  dropName("CONNORS BAPTIST CHURCH CEMETERY FUND");
  keepName("First Church of Christ, Scientist");
  keepName("First Church of Christ Scientist", { denomination: "Church of Christ" });
  dropName("Christian Science Reading Room");
  dropName("Jehovah's Witnesses");
  keepName("Jehovah Shammah");
  dropName("Kingdom Hall of Jehovah's Witnesses");
  keepName("Evangel Temple", { denomination: "Assemblies of God" });
  dropName("TEMPLE EMANUEL", { ntee: "X21" });
  dropName("TEMPLE BET YAM", { ntee: "X20" });
  dropName("BBF OF TEMPLE TERRACE INC", { ntee: "X20Z" });
  keepName("EMMANUEL EMPOWERMENT TEMPLE", { ntee: "X20" });
  keepName("Bethel Baptist Church");
  keepName("Bethlehem Baptist Church");
  keepName("Bethany Baptist Church");
  dropName("BETH HANAN MINISTRIES INC", { ntee: "X99Z" });
  keepName("Beth Eden Baptist Church", { denomination: "Baptist" });
  dropName("WAT FLORIDA DHAMMARAM INC");
  dropName("BAHAIS OF VALDOSTA");
  dropName("FLORIDA-BAHAMAS SYNOD ELCA");
  keepName("LUTHERAN CHURCH MISSOURI SYNOD");
  dropName("THEOSOPHICAL SOCIETY IN ORLANDO");
  dropName("HOUSE OF LIVING WATER", { ntee: "X30" });
  keepName("HOUSE OF LIVING WATER", { ntee: "X30", id: "5f1f1277" });
  keepName("DIVINE WORSHIP HOUSE OF GOD", { ntee: "X30" });
  dropName("ST MICHAELS CHURCH", { ntee: "X30" });
  dropName("COMPASSION TO THE NATIONS INC", { ntee: "X21", id: "b70a9179" });
  keepName("COMPASSION TO THE NATIONS INC", { ntee: "X21" });
  keepName("TO THE NATIONS MINISTRIES INC", { ntee: "X21" });
  dropName("A VOICE TO THE NATIONS INC", { ntee: "NOT AVAILABLE" });
  dropName("NEW LATTER DAY DELIVERANCE MINISTRIES INC");
  keepName("Hebron Valley Mission", { ntee: "X21" });
  dropName("BETHANY JUNIOR ACADEMY", { denomination: "Seventh-day Adventist" });
  dropName("EPISCOPAL DIOCESE OF GEORGIA", { denomination: "Episcopal" });
  dropName("First Baptist Preschool Gray Ga", { denomination: "Baptist" });
  const inbound = av.rankTopProspects([
    { ...base, id: "face", name: "Face Baptist", website: "https://face.example", av_signals: signals(40, "high") },
    { ...base, id: "copy", name: "Face Baptist Copy", do_not_contact: true, possible_same_as: ["face"], website: "https://other.example", av_signals: signals(1, "low") }
  ], none, { tier: 0, now });
  assert(inbound.open.length === 0 && inbound.won.length === 0, "a do-not-contact copy that points at the church takes the group off");
  const other = { ...base, id: "cog", name: "Valdosta - Abundant Life Church of God", city: "Valdosta", zip_code: "31601", religion_guess: "other", website: "https://cog.example", av_signals: signals(5, "high") };
  const temple = { ...base, id: "temple-other", name: "Temple", religion_guess: "other", website: "https://temple-other.example", av_signals: signals(5, "high") };
  const keptOther = av.rankTopProspects([other, temple], none, { tier: 0, now });
  assert(keptOther.open.map((item) => item.churchId).join(",") === "cog", `religion other keeps a church name: ${keptOther.open.map((item) => item.churchId).join(",")}`);
  assert(av.avExcluded(other, none, now) === true && av.avExcluded(temple, none, now) === true, "AV list drops religion other whether or not the name has a church word");
  const claimed = av.rankTopProspects([{ ...base, id: "cl", name: "Claimed Chapel", website: "https://cl.example", verified: true, av_signals: signals(3, "low") }], none, { tier: 0, now });
  assert(claimed.open[0].status === "Claimed" && claimed.open[0].nextStep === "First visit", "claimed stays on the list");
  const tier0 = av.topTierFilter(0);
  assert(tier0.includes("doc->av_signals=not.is.null") && tier0.includes("doc->>zip_code.like.310*") && tier0.includes("doc->>state=in.(GA,Georgia)"), `tier 0 filter: ${tier0}`);
  assert(av.topTierFilter(2).includes("doc->>state=in.(FL,Florida)") && av.topTierFilter(3).includes('doc->>state=in.(SC,"South Carolina")'), "FL and SC filters");
  const goldenRaw = read("scripts/fixtures/top-prospects-golden.json");
  const goldenBlob = createHash("sha1").update(`blob ${Buffer.byteLength(goldenRaw)}\0${goldenRaw}`).digest("hex");
  assert(goldenBlob === "92bd0886c22d779af1be07bdc5cdfb03c81b4563", `golden fixture blob ${goldenBlob}`);
  const golden = JSON.parse(goldenRaw);
  const ccKeptIds = ["stream", "alpha", "mulberry", "mulberry-hidden", "gamma", "beta", "abundant", "zzz-near", "aaa-far", "keeper", "keeper-twin", "college", "won-new", "won-old", "mismatch", "yoga", "dnc", "desk-claim", "invited", "accepted", "qa", "atlanta", "no-zip", "florida", "blocked-email", "lost", "dnc-forward", "dnc-forward-copy", "dnc-reverse", "dnc-reverse-copy", "sup-forward", "sup-forward-copy", "sup-reverse", "sup-reverse-copy", "pittman-park", "labor-of-the-field", "knowles-chapel-cemetery", "morgan-baptist-cemetery", "south-whitesville", "foundation-baptist", "foundation-church", "new-foundation-holiness", "spiritual-foundation-ministries", "trinity-foundation-missionary", "christ-foundation-ministries", "evangel-temple", "evangelistic-temple", "emmanuel-empowerment-temple", "glorious-bethlehem-temple", "prayer-temple-savannah", "rccg-victory-temple", "israels-temple", "temple-higher-calling", "holy-temple-mission", "jehovah-shammah", "faith-foundation-cogic", "true-foundation-cog", "solid-foundation-worship", "christ-scientist-thomasville", "christ-scientist-macon", "christ-scientist-columbus", "66d05a91", "561dcba9", "3a0e3f74", "27bfa71e", "aedd5bf3", "5f1f1277", "236b72d8", "f73383bb", "8102c0a0", "4cd9faf5"];
  const keptByName = golden.rows.filter((row) => !names.topNameExcluded(String(row.name ?? ""), row)).map((row) => String(row.id));
  const keptSet = new Set(keptByName);
  const ccKeptSet = new Set(ccKeptIds);
  const keptOnly = keptByName.filter((id) => !ccKeptSet.has(id));
  const ccOnly = ccKeptIds.filter((id) => !keptSet.has(id));
  assert(keptSet.size === ccKeptIds.length && keptOnly.length === 0 && ccOnly.length === 0, `name rule kept set differs from CC: ts-only ${keptOnly.join(",")} cc-only ${ccOnly.join(",")}`);
  const emails = new Set((golden.suppressions.emails || []).map((value) => String(value).trim().toLowerCase()));
  const domains = new Set((golden.suppressions.domains || []).map((value) => String(value).trim().toLowerCase()));
  const phones = new Set((golden.suppressions.phones || []).map((value) => String(value).replace(/\D/g, "")));
  const goldenSuppressed = (row) => {
    const email = String(row.email || "").trim().toLowerCase();
    if (email && emails.has(email)) return true;
    const host = String(row.website || "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (host && domains.has(host)) return true;
    const phone = String(row.phone || "").replace(/\D/g, "");
    return Boolean(phone && phones.has(phone));
  };
  const goldenRank = av.rankTopProspects(golden.rows, goldenSuppressed, { tier: golden.tier, now: new Date(golden.now) });
  assert(JSON.stringify(goldenRank.open.map((item) => item.churchId)) === JSON.stringify(golden.open_ids), `golden open: ${goldenRank.open.map((item) => item.churchId).join(",")}`);
  const wonPairs = goldenRank.won.map((item) => ({ id: item.churchId, date: item.wonDate }));
  assert(JSON.stringify(wonPairs) === JSON.stringify(golden.won), `golden won: ${JSON.stringify(wonPairs)}`);
  const byId = Object.fromEntries(goldenRank.open.map((item) => [item.churchId, item]));
  assert(byId.stream.score === 85 && byId.stream.reason.includes("livestreams on YouTube"), `stream ${byId.stream.score} ${byId.stream.reason}`);
  assert(byId.mulberry.score === 71, `mulberry twin score ${byId.mulberry.score} ${byId.mulberry.reason}`);
  assert(byId["zzz-near"].rank < byId["aaa-far"].rank, "same score, nearer Vidalia first");
  assert(goldenRank.won[0].churchId === "won-new", "newest win is first on the Won strip");
  const tier1 = av.rankTopProspects(golden.rows, goldenSuppressed, { tier: 1, now: new Date(golden.now) });
  assert(tier1.open.map((item) => item.churchId).join(",") === "atlanta,no-zip", `rest of GA: ${tier1.open.map((item) => item.churchId).join(",")}`);
  const openIds = new Set(goldenRank.open.map((item) => item.churchId));
  const wonIds = new Set(goldenRank.won.map((item) => item.churchId));
  for (const gone of ["mismatch", "endowment", "yoga", "dnc", "desk-claim", "invited", "qa", "assoc", "blocked-email", "lost", "keeper-twin", "mulberry-hidden", "atlanta", "no-zip", "dnc-forward", "dnc-forward-copy", "dnc-reverse", "dnc-reverse-copy", "sup-forward", "sup-forward-copy", "sup-reverse", "sup-reverse-copy", "incarnation-conference", "mission-inc", "soccer-fields", "first-baptist-foundation", "connors-cemetery-fund"]) {
    assert(!openIds.has(gone) && !wonIds.has(gone), `${gone} stays off the tier 0 lists`);
  }
  for (const excludedId of golden.excluded_ids) assert(!openIds.has(excludedId) && !wonIds.has(excludedId), `${excludedId} stays off the golden lists`);
  assert(golden.excluded_ids.includes("soccer-fields"), "soccer-fields is excluded because fields follows soccer");
  const census = av.TOP_PROSPECT_KEPT_CENSUS;
  assert(census.centralSouthGa === 9609 && census.restOfGa === 0 && census.florida === 3190 && census.southCarolina === 1812, `documentation-only: published ChurchConnect census, not recomputed from the fixture (${census.centralSouthGa}/${census.restOfGa}/${census.florida}/${census.southCarolina})`);
  assert(census.centralSouthGa + census.restOfGa + census.florida + census.southCarolina === 14611 && census.total === 14611 && census.inScope === 15476, "documentation-only: published ChurchConnect census, 14,611 kept of 15,476 in scope, not recomputed from the fixture");
  assert(av.resolveTopProspectTier("1").status === 422 && av.resolveTopProspectTier("9").status === 422 && av.resolveTopProspectTier("1").detail === "That area is not on this list.", "tier 1 and any other unsupported tier are 422");
  assert(av.resolveTopProspectTier(null).tier === 0 && av.resolveTopProspectTier("0").tier === 0 && av.resolveTopProspectTier("2").tier === 2 && av.resolveTopProspectTier("3").tier === 3, "tiers 0, 2, and 3 stay on the list");
  const route = read("src/app/api/crm/top-prospects/route.ts");
  assert(route.includes("status: 422") && route.includes("resolveTopProspectTier"), "the top-prospects route returns 422 for an unsupported tier");
  const cleared = JSON.parse(JSON.stringify(golden));
  cleared.suppressions = { emails: [], domains: [], phones: [] };
  const clearedRank = av.rankTopProspects(cleared.rows, () => false, { tier: cleared.tier, now: new Date(cleared.now) });
  const clearedIds = new Set(clearedRank.open.map((item) => item.churchId));
  assert(clearedIds.has("sup-forward") && clearedIds.has("sup-reverse"), "clearing the email list puts both link directions back");
  for (const gone of ["dnc-forward", "dnc-forward-copy", "dnc-reverse", "dnc-reverse-copy", "sup-forward-copy", "sup-reverse-copy"]) {
    assert(!clearedIds.has(gone), `${gone} stays off when the email list is empty`);
  }
  const crowdedRows = [];
  for (let n = 0; n < 4; n += 1) {
    crowdedRows.push({
      id: `shared-${n}`, name: `Shared Baptist ${n}`, state: "GA", zip_code: "30474", city: "Vidalia", active: true, is_public: true,
      email: `office${n}@shared.example`, website: "https://shared.example",
      av_signals: { av_score: 40, av_reasons: ["on file"] }, churchconnect_fit: "high"
    });
  }
  crowdedRows.push({
    id: "exact-mail", name: "Exact Mail Baptist", state: "GA", zip_code: "30474", city: "Vidalia", active: true, is_public: true,
    email: "pastor@shared.example", av_signals: { av_score: 80, av_reasons: ["on file"] }, churchconnect_fit: "high"
  });
  const crowdedHit = (row) => {
    const email = String(row.email || "").trim().toLowerCase();
    if (email === "pastor@shared.example") return true;
    const host = String(row.website || "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split("/")[0];
    return host === "shared.example";
  };
  const crowdedNotes = [];
  const originalWarn = console.warn;
  console.warn = (...args) => {
    crowdedNotes.push(args.map(String).join(" "));
    originalWarn(...args);
  };
  let crowdedRank;
  let crowdedAgain;
  try {
    crowdedRank = av.rankTopProspects(crowdedRows, crowdedHit, { tier: 0, now: new Date(golden.now) });
    crowdedAgain = av.rankTopProspects(crowdedRows, crowdedHit, { tier: 2, now: new Date(golden.now) });
  } finally {
    console.warn = originalWarn;
  }
  const crowdedIds = crowdedRank.open.map((item) => item.churchId);
  assert(crowdedIds.includes("shared-0") && !crowdedIds.includes("exact-mail"), `a domain used by more than three churches matches only the exact email: ${crowdedIds.join(",")}`);
  assert(crowdedAgain.open.length === 0, "Florida has none of these rows");
  assert(crowdedNotes.filter((line) => line.includes("shared.example")).length === 2, `shared domain logged once per rank call: ${crowdedNotes.join(" | ")}`);
  const failRows = crowdedRows.map((row) => ({ ...row, id: `${row.id}-fail` }));
  const failNotes = [];
  av.setSharedDomainCounterForTest(() => {
    throw new Error("count failed");
  });
  console.warn = (...args) => {
    failNotes.push(args.map(String).join(" "));
  };
  let failRank;
  try {
    failRank = av.rankTopProspects(failRows, crowdedHit, { tier: 0, now: new Date(golden.now) });
    av.rankTopProspects(failRows, crowdedHit, { tier: 0, now: new Date(golden.now) });
  } finally {
    console.warn = originalWarn;
    av.setSharedDomainCounterForTest(null);
  }
  const failIds = failRank.open.map((item) => item.churchId);
  assert(failIds.includes("shared-0-fail") && !failIds.includes("exact-mail-fail"), `a failed shared-domain count matches the exact email only: ${failIds.join(",")}`);
  assert(failNotes.filter((line) => line.includes("exact email only")).length === 2, `failed count logged once per call: ${failNotes.join(" | ")}`);
  for (const item of [...goldenRank.open, ...goldenRank.won]) {
    assert(item.reason.length <= 90, `reason length ${item.churchId}`);
    if (item.miles !== null) assert(Number.isInteger(item.miles), `whole miles ${item.churchId}`);
  }
  const loader = read("src/lib/engine/lpl-crm.ts");
  const avBody = loader.slice(loader.indexOf("export async function loadAvProspects"), loader.indexOf("export async function loadTopProspects"));
  assert(avBody.includes("avSuppressionMatcher("), "AV loader uses the #416 suppression matcher");
  assert(!/\bsuppressionMatcher\(/.test(avBody), "AV loader does not call the top matcher");
  assert(avBody.includes(', "av")') && !avBody.includes(', "top")'), "AV loader asks for the one-hop mate read");
  assert(!avBody.includes("readLinkedCopies"), "AV loader does not page linked copies");
  const avMates = loader.slice(loader.indexOf("async function readAvProspectMates"), loader.indexOf("const LINK_MAX_PAGES"));
  assert(!avMates.includes("readLinkedCopies") && !avMates.includes("LINK_MAX_PAGES") && !avMates.includes("readChurchPages"), "AV mate read is one hop and one page");
  const avIdLookup = avMates.slice(0, avMates.indexOf("possible_same_as.cs."));
  const avPointedLookup = avMates.slice(avMates.indexOf("possible_same_as.cs."));
  assert(!avIdLookup.includes("batch.length >= AV_PAGE"), "AV id lookup does not fail when the page is full");
  assert(avPointedLookup.includes("batch.length >= AV_PAGE"), "AV pointed lookup fails when the page is full");
  assert((avMates.match(/readRows\(/g) || []).length === 3, "AV mate read is the id lookup, the pointed lookup, and the name lookup");
  const topMates = loader.slice(loader.indexOf("async function readProspectMates"), loader.indexOf("async function readAvProspectMates"));
  assert((topMates.match(/readLinkedCopies\(/g) || []).length === 2, "top mate read follows the second hop");
  const topBody = loader.slice(loader.indexOf("export async function loadTopProspects"));
  assert(topBody.includes("topTierFilter(tier)") && topBody.includes("readChurchPages") && topBody.includes("readDoNotContact") && topBody.includes("loadCrmSnapshot"), "top loader shares the fetch and joins the snapshot");
  assert(topBody.includes("public.outreach_suppressions") && topBody.includes("select=email,domain,phone,brand"), "suppressions are the plain public columns, including brand");
  assert(topBody.includes(', "top"') && topBody.includes("possible_same_as.cs.") && topBody.includes("readLinkedCopies") && topBody.includes("LINK_MAX_PAGES * AV_PAGE"), "top loader pages both link directions, and a full read fails closed");
  assert(!/method:\s*"(POST|PATCH|PUT|DELETE)"/.test(topBody), "top loader does not write");
  const topAct = read("src/app/(cockpit)/crm/actions.ts").slice(read("src/app/(cockpit)/crm/actions.ts").indexOf("export async function loadTopProspectsAction"));
  assert(/^export async function loadTopProspectsAction[^{]+\{\s*if \(!\(await canAccessEngineOwner\(\)\)\) return refused\(/.test(topAct), "top action is owner gated");
  const desk = read("src/components/engine/crm-desk.tsx");
  assert(desk.includes('data-testid="crm-top-chip"') && desk.includes("Top prospects"), "top chip sits with the AV chip");
  const ui = read("src/components/engine/crm-top-prospects.tsx");
  assert(ui.includes("No scored churches in Florida yet.") && ui.includes("Central & South GA") && ui.includes("Florida") && ui.includes("South Carolina") && ui.includes("/super-admin#crm/lead/"), "tier chips, Florida empty copy, row opens the church");
  assert(!ui.includes('label: "Rest of GA"') && ui.includes("Rest of Georgia stays hidden"), "Rest of Georgia tab stays hidden until those churches are scored");
  assert(ui.includes("Anyone who opted out of any of our messages is left off this list."), "opt-out footer");
  assert(!/xai|grok|openai|anthropic|claude|gpt|marketing/i.test(ui), "no vendor names and no marketing");
  const page = read("src/app/(cockpit)/crm/page.tsx");
  const accessAt = page.indexOf("canAccessEngineAdmin");
  const fixtureAt = page.indexOf("top-prospects-golden.json");
  assert(accessAt >= 0 && fixtureAt > accessAt, "the admin check runs before the preview fixture is loaded");
  assert(page.includes('process.env.NODE_ENV !== "production"') && page.includes('await import("../../../../scripts/fixtures/top-prospects-golden.json")'), "the preview fixture is a dynamic import behind the non-production guard");
  assert(!page.includes('from "@/lib/engine/av-prospects-core"'), "the page does not statically import the ranker");
});

await step("AV suppression matches #416; the new matcher stays on the top list", () => {
  const listed = [
    { domain: "umc.org" },
    { domain: "sgaumc.org" },
    { domain: "bellsouth.net" },
    { phone: "4045550143" },
    { phone: "5550143" },
    { brand: "hidden@brand.example" },
    { brand: "brandchurch.example" }
  ];
  const match = crm.avSuppressionMatcher(listed);
  assert(match({ website: "https://www.umc.org/church" }), "umc.org still suppresses a church website");
  assert(match({ email: "office@sgaumc.org" }), "sgaumc.org still suppresses that email host");
  assert(match({ website: "https://bellsouth.net" }), "bellsouth.net still suppresses a website");
  assert(match({ email: "a@bellsouth.net" }), "bellsouth.net still suppresses that email host");
  assert(match({ phone: "404-555-0143" }), "a 10-digit phone still suppresses");
  assert(!match({ phone: "555-0143" }), "a 7-digit phone does not suppress on the AV list");
  assert(!match({ phone: "404-555-0143 x12" }), "an extension does not change the AV phone match");
  assert(!match({ email: "hidden@brand.example" }), "a brand email does not suppress on the AV list");
  assert(!match({ website: "https://brandchurch.example" }), "a brand domain does not suppress on the AV list");
  assert(crm.avNormPhone("404-555-0143 x12") === "" && crm.avNormPhone("4045550143x12") === "", "AV phone normalizer keeps the extension digits");
  assert(crm.normPhone("404-555-0143 x12") === "4045550143" && crm.normPhone("4045550143x12") === "4045550143", "the CRM phone normalizer still strips the extension");
  assert(crm.avNormPhone("555-0143") === "", "AV phone normalizer drops a 7-digit number");
  assert(crm.suppressionPhone("555-0143") === "5550143", "the top-list phone key keeps 7 digits");
  const index = { emails: new Set(), domains: new Set(), phones: new Set() };
  for (const row of listed) {
    const keys = crm.suppressionKeys(row);
    for (const email of keys.emails) index.emails.add(email);
    for (const domain of keys.domains) index.domains.add(domain);
    for (const phone of keys.phones) index.phones.add(phone);
  }
  assert(!crm.rowMatchesSuppression({ website: "https://www.umc.org/church" }, index), "top matcher does not treat umc.org as its own domain");
  assert(!crm.rowMatchesSuppression({ email: "office@sgaumc.org" }, index), "top matcher does not treat sgaumc.org as its own domain");
  assert(!crm.rowMatchesSuppression({ website: "https://bellsouth.net" }, index) && !crm.rowMatchesSuppression({ email: "a@bellsouth.net" }, index), "top matcher does not treat bellsouth.net as its own domain");
  assert(crm.rowMatchesSuppression({ phone: "555-0143" }, index), "top matcher matches a 7-digit phone");
  assert(crm.rowMatchesSuppression({ phone: "404-555-0143 x12" }, index), "top matcher strips the extension before matching");
  assert(crm.rowMatchesSuppression({ email: "hidden@brand.example" }, index), "top matcher reads an email in the brand column");
  assert(crm.rowMatchesSuppression({ website: "https://brandchurch.example" }, index), "top matcher reads a domain in the brand column");
});

function churchSame(av, left, right) {
  return av.websiteGroupKey(left, "Vidalia", "GA") !== "" && av.websiteGroupKey(left, "Vidalia", "GA") === av.websiteGroupKey(right, "Vidalia", "GA");
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall AV prospect checks passed");
