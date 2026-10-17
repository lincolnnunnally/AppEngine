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
const ruleUrl = toUrl(transpile("src/lib/engine/church-offer-rule.ts"));
const coreUrl = toUrl(transpile("src/lib/engine/crm-suggest-core.ts", { "./church-offer-rule": ruleUrl }));
const xaiUrl = toUrl(transpile("src/lib/xai.ts"));
const core = await import(coreUrl);
const server = await import(toUrl(transpile("src/lib/engine/crm-suggest.ts", { "@/lib/xai": xaiUrl, "@/lib/engine/crm-suggest-core": coreUrl })));

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
  assert(core.allowedOffers("church", card()).every((o) => ["churchconnect", "easypeazy", "laser", "outreach"].includes(o.id)), "church list = the rule");
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

await step("minimal data: no name, contacts, emails, phones or visit notes are sent", () => {
  const input = core.suggestInput(card(), "church", NOW);
  const text = JSON.stringify(input);
  for (const bad of ["Grace Fellowship", "Jane", "Sam", "@", "555", "Visit — met", "office@", "Secretary"]) assert(!text.includes(bad), `sent ${bad}: ${text}`);
  assert(
    JSON.stringify(Object.keys(input).sort()) ===
      JSON.stringify(["allowed_apps", "apps_on_record", "apps_picked", "next_step", "next_step_due", "org_type", "recent_activity", "status", "today", "town"]),
    `fields: ${Object.keys(input)}`
  );
  assert(input.recent_activity.length === 2 && JSON.stringify(Object.keys(input.recent_activity[0]).sort()) === JSON.stringify(["by_us", "date", "they_responded", "type"]), "activity = type and date only");
  assert(input.next_step === "Call Pastor them", `next step scrubbed: ${input.next_step}`);
  const named = core.suggestInput(card({ nextStep: "Bring Grace Fellowship a gift box" }), "church", NOW);
  assert(named.next_step === "Bring the church a gift box", named.next_step);
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
