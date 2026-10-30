// Campaign Builder — pure parts. A company says "I have this idea for this
// product, build the whole thing out": this turns one short brief into a
// ready-to-run campaign kit (positioning, a three-email sequence with A/B
// subjects, landing page copy, a campaign dashboard plan, a launch checklist)
// and checks the copy against the company's rules.
//
// Deterministic on purpose: the same brief always gives the same kit, so the
// kit works with no AI provider at all. campaign-builder.ts may polish the
// wording with AI, but only through mergePolishedCopy() below, which refuses
// anything that changes the shape or breaks a rule.
//
// No imports: node:test runs this file directly.

export type CampaignBrief = {
  /** Who is speaking. "United Under God". */
  company: string;
  /** The idea / product being promoted. */
  product: string;
  /** Who it is for. */
  audience: string;
  /** What the company offers or promises, in its own words. */
  offer: string;
  /** True facts only — never invented. Each line is used as written. */
  proof?: string[];
  /** Where the work happens, if different from the audience line. */
  region?: string;
  /** Where the emails send people. */
  landingUrl?: string;
  /** Who signs the emails. Defaults to "The <company> team". */
  sender?: string;
  /** How many companies are ready to bid, when the offer is a bid. */
  bidders?: number;
  /** Words or phrases the copy must never use ("free", "AI", "no prices"). */
  rules?: string[];
  /** Names that must never appear in copy (for example the bidding companies). */
  keepPrivate?: string[];
};

export type CampaignEmail = {
  step: 1 | 2 | 3;
  name: string;
  /** Days after the first send. */
  sendDay: number;
  subjectA: string;
  subjectB: string;
  preview: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
};

export type LandingFormField = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select";
  required: boolean;
  options?: string[];
};

export type CampaignLanding = {
  slug: string;
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  lead: string;
  benefits: Array<{ title: string; body: string }>;
  steps: string[];
  faq: Array<{ q: string; a: string }>;
  formFields: LandingFormField[];
  cta: string;
};

export type FunnelStage = { key: string; label: string; meaning: string };

export type CampaignDashboard = {
  stages: FunnelStage[];
  metrics: Array<{ label: string; how: string }>;
  sendPlan: {
    startPerDay: number;
    ladder: number[];
    minSendsPerSubject: number;
    winMarginPoints: number;
    rule: string;
    pauseRule: string;
  };
};

export type CampaignKit = {
  version: 1;
  generatedBy: "template" | "ai";
  positioning: { oneLiner: string; problem: string; promise: string };
  emails: CampaignEmail[];
  landing: CampaignLanding;
  dashboard: CampaignDashboard;
  checklist: string[];
  /** The copy rules this kit was checked against (brief rules + guards). */
  guard: { rules: string[]; pricesAllowed: boolean; keepPrivate: string[] };
};

export type CopyProblem = { where: string; found: string; rule: string };

export type CleanBriefResult = { ok: true; brief: CampaignBrief } | { ok: false; errors: string[] };

// ---------------------------------------------------------------------------
// Brief
// ---------------------------------------------------------------------------

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function list(value: unknown, maxItems: number, maxLength: number): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n|,(?![^(]*\))/) : [];
  const out: string[] = [];
  for (const item of raw) {
    const clean = text(item).slice(0, maxLength);
    if (clean && !out.some((existing) => existing.toLowerCase() === clean.toLowerCase())) out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Proof lines are sentences, so they split on new lines only, never commas. */
function lines(value: unknown, maxItems: number, maxLength: number): string[] {
  if (typeof value === "string") return list(value.split(/\r?\n/), maxItems, maxLength);
  return list(value, maxItems, maxLength);
}

export function cleanBrief(input: unknown): CleanBriefResult {
  const errors: string[] = [];
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Tell us about the company and the idea first."] };
  }
  const raw = input as Record<string, unknown>;
  const company = text(raw.company);
  const product = text(raw.product);
  const audience = text(raw.audience);
  const offer = text(raw.offer);
  const region = text(raw.region);
  const sender = text(raw.sender);
  const landingUrl = text(raw.landingUrl);

  if (company.length < 2) errors.push("Add the company name.");
  else if (company.length > 80) errors.push("Keep the company name under 80 characters.");
  if (product.length < 6) errors.push("Describe the product or idea in a few words.");
  else if (product.length > 200) errors.push("Keep the product description under 200 characters.");
  if (audience.length < 4) errors.push("Say who this is for.");
  else if (audience.length > 200) errors.push("Keep the audience under 200 characters.");
  if (offer.length < 10) errors.push("Say what you are offering them, in a sentence.");
  else if (offer.length > 500) errors.push("Keep the offer under 500 characters.");
  if (region.length > 120) errors.push("Keep the region under 120 characters.");
  if (sender.length > 80) errors.push("Keep the sender name under 80 characters.");

  if (landingUrl) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(landingUrl);
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.protocol !== "https:" || !parsed.hostname.includes(".")) {
      errors.push("The landing page address must be a full https:// address.");
    }
  }

  let bidders: number | undefined;
  if (raw.bidders !== undefined && raw.bidders !== null && raw.bidders !== "") {
    const n = typeof raw.bidders === "number" ? raw.bidders : Number(String(raw.bidders).trim());
    if (!Number.isInteger(n) || n < 1 || n > 12) {
      errors.push("The number of companies ready to bid must be a whole number from 1 to 12.");
    } else {
      bidders = n;
    }
  }

  if (errors.length) return { ok: false, errors };

  const brief: CampaignBrief = { company, product, audience, offer };
  const proof = lines(raw.proof, 8, 240);
  if (proof.length) brief.proof = proof;
  if (region) brief.region = region;
  if (landingUrl) brief.landingUrl = landingUrl;
  if (sender) brief.sender = sender;
  if (bidders !== undefined) brief.bidders = bidders;
  const rules = list(raw.rules, 30, 80);
  if (rules.length) brief.rules = rules;
  const keepPrivate = list(raw.keepPrivate, 20, 120);
  if (keepPrivate.length) brief.keepPrivate = keepPrivate;
  return { ok: true, brief };
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function cap(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** Lower-case the first letter unless the first word looks like an acronym ("LED"). */
function inline(value: string): string {
  const first = value.split(" ")[0] || "";
  if (/^I('|$)/.test(first) || (first.length > 1 && first === first.toUpperCase())) return value;
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function stripEnd(value: string): string {
  return value.replace(/[.!?\s]+$/, "");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

const AUDIENCE_NOUNS: Array<[RegExp, string, string]> = [
  [/\bchurch(es)?\b|\bministr(y|ies)\b|\bcongregations?\b/i, "church", "churches"],
  [/\bschools?\b/i, "school", "schools"],
  [/\brestaurants?\b/i, "restaurant", "restaurants"],
  [/\bclinics?\b|\bpractices?\b/i, "practice", "practices"],
  [/\bnonprofits?\b|\bnon-profits?\b|\bcharit(y|ies)\b/i, "organization", "organizations"],
  [/\bshops?\b|\bstores?\b/i, "shop", "shops"],
  [/\bfamil(y|ies)\b|\bparents?\b/i, "family", "families"],
  [/\bhomeowners?\b|\bhomes?\b/i, "home", "homes"]
];

/** "churches in South Georgia" → church / churches. Falls back to team / teams. */
export function audienceNoun(audience: string): { one: string; many: string } {
  for (const [pattern, one, many] of AUDIENCE_NOUNS) {
    if (pattern.test(audience)) return { one, many };
  }
  if (/\bbusiness(es)?\b|\bcompan(y|ies)\b/i.test(audience)) return { one: "business", many: "businesses" };
  return { one: "team", many: "teams" };
}

/** "LED walls, stage lighting and sound for church sanctuaries" → "LED walls, stage lighting and sound". */
export function productShort(product: string): string {
  const cut = product.split(/\s+(?:for|to|that|which|so)\s+/i)[0] || product;
  return stripEnd(cut);
}

/** The first thing named: "LED walls, stage lighting and sound" → "LED walls". */
export function productTopic(product: string): string {
  const short = productShort(product);
  return stripEnd(short.split(/,|\s+and\s+|\s+&\s+|\s+or\s+/i)[0] || short).trim() || short;
}

function trimToWords(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return stripEnd((space > 20 ? cut.slice(0, space) : value.slice(0, max)).replace(/[,;:\-–—]+$/, ""));
}

function withUtm(base: string, campaign: string, content: string): string {
  if (!base) return "";
  try {
    const url = new URL(base);
    url.searchParams.set("utm_source", "email");
    url.searchParams.set("utm_medium", "email");
    url.searchParams.set("utm_campaign", campaign);
    url.searchParams.set("utm_content", content);
    return url.toString();
  } catch {
    return base;
  }
}

/**
 * Fit sentences into [min, max] characters, never cutting mid-word. Main
 * sentences go first; fillers are added while they fit; generic pads only
 * when a very short brief still leaves it under the minimum.
 */
export function fitSentences(sentences: string[], fillers: string[], min: number, max: number): string {
  const main = sentences.map((s) => s.trim()).filter(Boolean);
  let out = "";
  for (const sentence of main) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length <= max) out = next;
  }
  if (!out) out = `${trimToWords(main[0] || "", max - 1)}.`;
  for (const filler of fillers.map((s) => s.trim()).filter(Boolean)) {
    const next = `${out} ${filler}`;
    if (next.length <= max) out = next;
  }
  const pads = ["Read how it works and take the first step today.", "Questions are welcome.", "Reply any time."];
  for (const pad of pads) {
    if (out.length >= min) break;
    const next = `${out} ${pad}`;
    if (next.length <= max) out = next;
    else out = `${out} ${trimToWords(pad, max - out.length - 2)}.`;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------

function parseRules(rules: string[]): { phrases: string[]; banPrices: boolean; banNames: boolean } {
  const phrases: string[] = [];
  let banPrices = false;
  let banNames = false;
  for (const rule of rules) {
    const body = rule
      .trim()
      .replace(/^(no|never|don'?t (say|use|mention)|do not (say|use|mention)|avoid|not)\s+/i, "")
      .replace(/^["'“‘]|["'”’]$/g, "")
      .trim();
    if (!body) continue;
    if (/^(prices?|pricing|dollar amounts?|dollars|costs?)$/i.test(body)) {
      banPrices = true;
      continue;
    }
    if (/\b(installer|vendor|company|bidder|contractor|partner)s?('s)? names?\b/i.test(body)) {
      banNames = true;
      continue;
    }
    phrases.push(body);
  }
  return { phrases, banPrices, banNames };
}

const PRICE_PATTERN = /\$\s?\d|\b\d[\d,.]*\s?(dollars|usd|bucks)\b|\b\d+\s?k\b\s?(budget|price)/i;

function briefGivesPrices(brief: CampaignBrief): boolean {
  return [brief.offer, ...(brief.proof ?? [])].some((line) => PRICE_PATTERN.test(line));
}

export function buildCampaignKit(brief: CampaignBrief): CampaignKit {
  const company = brief.company;
  const noun = audienceNoun(brief.audience);
  const short = productShort(brief.product);
  const topic = inline(productTopic(brief.product));
  const product = inline(stripEnd(brief.product));
  const audience = inline(stripEnd(brief.audience));
  const where = brief.region ? brief.region : audience;
  const offer = stripEnd(brief.offer);
  const bidders = brief.bidders;
  const n = bidders ? numberWord(bidders) : "";
  const companiesWord = bidders === 1 ? "company" : "companies";
  const bidsWord = bidders === 1 ? "bid" : "bids";
  const signer = brief.sender || `The ${company} team`;
  const proof = brief.proof ?? [];
  const allowsNone = /\bnone\b|\bno obligation\b|\bnot required\b/i.test(brief.offer);
  const parsed = parseRules(brief.rules ?? []);

  let slug = "";
  if (brief.landingUrl) {
    try {
      const segments = new URL(brief.landingUrl).pathname.split("/").filter(Boolean);
      slug = slugify(segments[segments.length - 1] || "");
    } catch {
      slug = "";
    }
  }
  if (!slug) slug = slugify(`${topic} ${noun.one}`) || "campaign";
  const landingBase = brief.landingUrl || "";

  // Positioning --------------------------------------------------------------
  const oneLiner = bidders
    ? `${company} helps ${audience} get ${n} side-by-side ${bidsWord} for ${product}.`
    : `${company} helps ${audience} with ${product}.`;
  const problem = bidders
    ? `It is hard to judge ${inline(short)} from one proposal. Every company describes the work its own way, so ${noun.many} cannot compare like with like.`
    : `It is hard to plan ${inline(short)} when every company describes the work its own way.`;
  const promise = `${offer}.`;

  // Emails -------------------------------------------------------------------
  const proofBlock = proof.length ? ["A few things that are true about us:", ...proof.map((line) => `- ${stripEnd(line)}.`), ""] : [];
  const steps = bidders
    ? [
        `Tell us about your ${noun.one} and what you need, once.`,
        `${cap(n)} ${companiesWord} bid on the same scope.`,
        `Compare the ${bidsWord} side by side.`,
        allowsNone ? "Choose one, or none." : "Choose the one that fits."
      ]
    : [
        `Tell us about your ${noun.one} and what you need.`,
        `We reply with a plan for ${inline(short)}.`,
        "Ask every question you have.",
        "Decide when you are ready."
      ];

  const subjects: Array<[string, string]> = bidders
    ? [
        [`${cap(n)} ${companiesWord} ready to bid on your ${topic} project`, `Thinking about ${topic} for your ${noun.one}?`],
        [`Your ${noun.one}, ${n} ${bidsWord}, one scope`, `Before you shop for ${topic}, read this`],
        [`Last note about ${topic} for your ${noun.one}`, `Should we close the loop on ${topic}?`]
      ]
    : [
        [`${cap(topic)} for your ${noun.one}, made simple`, `Thinking about ${topic} for your ${noun.one}?`],
        [`What ${topic} really takes`, `Before you shop for ${topic}, read this`],
        [`Last note about ${topic} for your ${noun.one}`, `Should we close the loop on ${topic}?`]
      ];

  const cta1 = `Tell us about your ${noun.one}`;
  const cta2 = bidders ? `Request ${n} ${bidsWord}` : "See how it works";
  const cta3 = "Start here";

  const email1Body = [
    "Hello,",
    "",
    `We are ${company}. We work with ${audience} on ${product}.`,
    "",
    problem,
    "",
    `Here is what we offer: ${inline(offer)}.`,
    "",
    ...proofBlock,
    `If your ${noun.one} has been talking about ${inline(short)}, the first step is one short form:`,
    "",
    `${cta1}: {{cta_url}}`,
    "",
    signer,
    company
  ].join("\n");

  const email2Body = [
    "Hello,",
    "",
    `A few days ago we wrote about ${inline(short)} for your ${noun.one}. Here is the short version of how it works:`,
    "",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    bidders && bidders > 1
      ? `You tell your story once instead of ${n} times, and every bid answers the same questions.`
      : "You tell your story once, and you get plain answers.",
    "",
    `${cta2}: {{cta_url}}`,
    "",
    "Or just reply to this email with a line about what you need.",
    "",
    signer,
    company
  ].join("\n");

  const email3Body = [
    "Hello,",
    "",
    `This is our last note about ${inline(short)}.`,
    "",
    "If the timing is wrong, no reply is needed and we will not keep writing.",
    "",
    `If it is right: ${inline(offer)}.`,
    "",
    `${cta3}: {{cta_url}}`,
    "",
    signer,
    company
  ].join("\n");

  const previews = [
    bidders ? `We are ${company}. ${cap(n)} ${companiesWord}, one scope, your choice.` : `We are ${company}. Here is a simpler way to plan ${inline(short)}.`,
    "How it works, in four short steps.",
    "If the timing is wrong, no reply is needed."
  ];

  const bodies = [email1Body, email2Body, email3Body];
  const ctas = [cta1, cta2, cta3];
  const names = ["First touch", "Follow-up", "Last note"];
  const days = [0, 4, 10];
  const emails: CampaignEmail[] = [0, 1, 2].map((i) => {
    const ctaUrl = withUtm(landingBase, slug, `e${i + 1}`);
    return {
      step: (i + 1) as 1 | 2 | 3,
      name: names[i],
      sendDay: days[i],
      subjectA: trimToWords(subjects[i][0], 78),
      subjectB: trimToWords(subjects[i][1], 78),
      preview: trimToWords(previews[i], 110),
      body: bodies[i].replace("{{cta_url}}", ctaUrl || "(landing page address)"),
      ctaLabel: ctas[i],
      ctaUrl
    };
  });

  // Landing page ---------------------------------------------------------------
  let title = `${cap(topic)} for your ${noun.one} | ${company}`;
  if (title.length > 60) title = `${cap(topic)} for your ${noun.one}`;
  title = trimToWords(title, 60);

  const metaDescription = fitSentences(
    [
      bidders
        ? `${cap(inline(short))} for ${audience}: ${n} ${companiesWord} bid on the same scope.`
        : `${cap(inline(short))} for ${audience}.`,
      bidders ? `Compare side by side and choose ${allowsNone ? "one, or none" : "the right fit"}.` : `${company} makes it simple.`
    ],
    [`From ${company}.`, `Tell us about your ${noun.one} once.`],
    120,
    165
  );

  const h1 = bidders
    ? `${cap(topic)} for your ${noun.one}, with ${n} ${bidsWord} to compare`
    : `${cap(inline(short))} for your ${noun.one}, made simple`;
  const lead = `We are ${company}. ${offer}.`;

  const benefits = bidders
    ? [
        { title: "Tell it once", body: `Describe your ${noun.one} and what you need one time. You do not repeat yourself to every company.` },
        { title: "Same scope, fair comparison", body: `Every company bids on the same scope, so the ${bidsWord} line up side by side.` },
        {
          title: "Your choice",
          body: allowsNone ? "Choose one, or none. Nothing is decided until you decide." : "Nothing is decided until you decide."
        },
        { title: `${company} in your corner`, body: `You deal with ${company}, not a stack of sales calls.` }
      ]
    : [
        { title: "Plain answers", body: `Clear words about ${inline(short)}, without the jargon.` },
        { title: `Built around your ${noun.one}`, body: `We start from what your ${noun.one} actually needs.` },
        { title: "No pressure", body: "Nothing is decided until you decide." },
        { title: "One point of contact", body: `You deal with ${company} from first question to final decision.` }
      ];

  const faq: Array<{ q: string; a: string }> = [
    { q: "How does this work?", a: steps.join(" ") },
    {
      q: `Who is ${company}?`,
      a: proof.length ? `${proof.map((line) => `${stripEnd(line)}.`).join(" ")}` : `We are ${company}. We work with ${audience}.`
    },
    { q: "Where do you work?", a: `We work with ${where}.` }
  ];
  if (bidders) {
    faq.push(
      allowsNone
        ? { q: "Do I have to choose one of the bids?", a: "No. You can choose one, or none." }
        : { q: "What happens after I send the form?", a: `${company} reads it and replies by email.` }
    );
  } else {
    faq.push({ q: "What happens after I send the form?", a: `${company} reads it and replies by email.` });
  }

  const formFields: LandingFormField[] = [
    { name: "name", label: "Your name", type: "text", required: true },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "phone", label: "Phone (optional)", type: "tel", required: false },
    { name: "organization", label: `${cap(noun.one)} name`, type: "text", required: true },
    { name: "town", label: "City or town", type: "text", required: true },
    {
      name: "needs",
      label: noun.one === "church" ? "Tell us about your room and what you need" : "What do you need?",
      type: "textarea",
      required: true
    },
    {
      name: "timeline",
      label: "When are you hoping to start?",
      type: "select",
      required: false,
      options: ["As soon as possible", "In the next 3 months", "In 3 to 6 months", "Just exploring"]
    }
  ];

  const landing: CampaignLanding = {
    slug,
    url: landingBase,
    title,
    metaDescription,
    h1,
    lead,
    benefits,
    steps,
    faq,
    formFields,
    cta: bidders ? `Request ${n} ${bidsWord}` : "Get started"
  };

  // Dashboard ------------------------------------------------------------------
  const stages: FunnelStage[] = [
    { key: "sent", label: "Sent", meaning: "Emails that went out." },
    { key: "opened", label: "Opened", meaning: "People who opened an email." },
    { key: "clicked", label: "Clicked", meaning: "People who opened the landing page from an email." },
    { key: "requested", label: bidders ? "Asked for bids" : "Asked", meaning: "People who sent the landing page form." },
    bidders
      ? { key: "bidding", label: "Bids in", meaning: `The ${companiesWord} have bid on their scope.` }
      : { key: "quoted", label: "Quoted", meaning: "They have a quote or plan in hand." },
    bidders
      ? { key: "chosen", label: "Chose a company", meaning: "They picked a bid." }
      : { key: "won", label: "Won", meaning: "They said yes." }
  ];

  const dashboard: CampaignDashboard = {
    stages,
    metrics: [
      { label: "Open rate", how: "Opened ÷ sent, for subject A and subject B separately." },
      { label: "Click rate", how: "Clicked ÷ sent." },
      { label: "Request rate", how: "Asked ÷ clicked — how well the landing page works." },
      { label: bidders ? "Choice rate" : "Win rate", how: bidders ? "Chose a company ÷ asked for bids." : "Won ÷ asked." },
      { label: "Stop rate", how: "Unsubscribes ÷ sent. Keep it under 1%." }
    ],
    sendPlan: {
      startPerDay: 10,
      ladder: [10, 25, 50, 100],
      minSendsPerSubject: 50,
      winMarginPoints: 5,
      rule:
        "Start small, scale winners: send 10 a day, half subject A and half subject B. Once each subject has at least 50 sends and one opens at least 5 points better, send only the winner and move up a step (10 → 25 → 50 → 100 a day). Then test a new subject B against the winner.",
      pauseRule: "Pause and look if more than 1% of a day's sends unsubscribe, or more than 3% bounce."
    }
  };

  // Checklist ------------------------------------------------------------------
  const checklist: string[] = [];
  if (!landingBase) checklist.push("Add the landing page address to the brief so every email links to it.");
  if (bidders) checklist.push(`Confirm ${n} ${companiesWord} have agreed to bid before the first email goes out.`);
  if (parsed.banNames || (brief.keepPrivate ?? []).length) {
    checklist.push("Keep the bidding companies unnamed in every email and on the page.");
  }
  checklist.push(
    "Read every proof line and FAQ answer out loud — keep only what is true today.",
    `Publish the landing page${landingBase ? ` at ${landingBase}` : ""} and send its form to a real inbox that someone reads daily.`,
    "Send yourself all three emails and click every button.",
    "Every email needs a one-click way to stop getting them and your mailing address at the bottom.",
    `Load a first list of ${audience} — only people who would expect to hear from ${company}.`,
    "Start at 10 a day, half subject A and half subject B.",
    "Clear the copy check before sending.",
    "Reply to every form the same day."
  );

  return {
    version: 1,
    generatedBy: "template",
    positioning: { oneLiner, problem, promise },
    emails,
    landing,
    dashboard,
    checklist,
    guard: {
      rules: [...(brief.rules ?? [])],
      pricesAllowed: briefGivesPrices(brief) && !parsed.banPrices,
      keepPrivate: [...(brief.keepPrivate ?? [])]
    }
  };
}

// ---------------------------------------------------------------------------
// Copy check
// ---------------------------------------------------------------------------

/** Every piece of customer-facing copy in the kit, with where it lives. */
export function kitCopy(kit: CampaignKit): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = [
    { where: "Positioning · one-liner", text: kit.positioning.oneLiner },
    { where: "Positioning · problem", text: kit.positioning.problem },
    { where: "Positioning · promise", text: kit.positioning.promise }
  ];
  for (const email of kit.emails) {
    const at = `Email ${email.step}`;
    out.push(
      { where: `${at} · subject A`, text: email.subjectA },
      { where: `${at} · subject B`, text: email.subjectB },
      { where: `${at} · preview`, text: email.preview },
      // The body carries the link; check the words, not the address.
      { where: `${at} · body`, text: email.body.replace(/https?:\/\/\S+/g, " ") },
      { where: `${at} · button`, text: email.ctaLabel }
    );
  }
  const l = kit.landing;
  out.push(
    { where: "Landing · title", text: l.title },
    { where: "Landing · description", text: l.metaDescription },
    { where: "Landing · headline", text: l.h1 },
    { where: "Landing · lead", text: l.lead },
    { where: "Landing · button", text: l.cta }
  );
  l.benefits.forEach((b, i) => out.push({ where: `Landing · benefit ${i + 1}`, text: `${b.title}. ${b.body}` }));
  l.steps.forEach((s, i) => out.push({ where: `Landing · step ${i + 1}`, text: s }));
  l.faq.forEach((f, i) => out.push({ where: `Landing · question ${i + 1}`, text: `${f.q} ${f.a}` }));
  l.formFields.forEach((f) => out.push({ where: `Landing · form`, text: [f.label, ...(f.options ?? [])].join(" ") }));
  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phrasePattern(phrase: string): RegExp {
  const words = phrase.trim().split(/\s+/).map(escapeRegExp).join("\\s+");
  // Short all-caps rules ("AI") match case-sensitively so "said" never trips.
  const caseSensitive = phrase.length <= 3 && phrase === phrase.toUpperCase() && /[A-Z]/.test(phrase);
  return new RegExp(`(?<![\\w-])${words}(?![\\w])`, caseSensitive ? "" : "i");
}

const DEFAULT_RULES: Array<{ rule: string; pattern: RegExp }> = [
  { rule: "Never promise a guarantee", pattern: /\bguarantee[sd]?\b|\bguaranteeing\b/i },
  {
    rule: "No ranking promises",
    pattern: /#\s?1\b|\bnumber one\b|\bno\.\s?1\b|\btop[- ]rated\b|\bbest in (the )?(state|country|region|area|town)\b|\b(first|top) page of google\b|\brank(ed)? (first|#?1|number one)\b|\bpage one\b/i
  }
];

/**
 * Flags copy that breaks a rule: always no guarantees and no ranking promises;
 * no prices or dollar amounts unless the brief itself gave one; plus every
 * brief rule ("free", "AI", "no prices", "no installer names") and every name
 * the brief keeps private.
 */
export function copyProblems(kit: CampaignKit, rules: string[] = kit.guard.rules): CopyProblem[] {
  const parsed = parseRules(rules);
  const checks: Array<{ rule: string; pattern: RegExp }> = [...DEFAULT_RULES];
  if (!kit.guard.pricesAllowed || parsed.banPrices) {
    checks.push({ rule: "No prices or dollar amounts", pattern: PRICE_PATTERN });
  }
  for (const phrase of parsed.phrases) {
    checks.push({ rule: `Never say "${phrase}"`, pattern: phrasePattern(phrase) });
  }
  for (const name of kit.guard.keepPrivate) {
    if (name.trim().length >= 2) checks.push({ rule: `Keep "${name}" private`, pattern: phrasePattern(name) });
  }

  const problems: CopyProblem[] = [];
  for (const piece of kitCopy(kit)) {
    for (const check of checks) {
      const match = piece.text.match(check.pattern);
      if (match) problems.push({ where: piece.where, found: match[0], rule: check.rule });
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// AI polish: accept better wording only when it keeps the exact shape
// ---------------------------------------------------------------------------

/** The part of the kit an AI may reword, sent out and accepted back. */
export type PolishableCopy = {
  positioning: { oneLiner: string; problem: string; promise: string };
  emails: Array<{ subjectA: string; subjectB: string; preview: string; body: string; ctaLabel: string }>;
  landing: {
    title: string;
    metaDescription: string;
    h1: string;
    lead: string;
    benefits: Array<{ title: string; body: string }>;
    steps: string[];
    faq: Array<{ q: string; a: string }>;
    cta: string;
  };
};

export function polishableCopy(kit: CampaignKit): PolishableCopy {
  return {
    positioning: { ...kit.positioning },
    emails: kit.emails.map((e) => ({
      subjectA: e.subjectA,
      subjectB: e.subjectB,
      preview: e.preview,
      body: e.body,
      ctaLabel: e.ctaLabel
    })),
    landing: {
      title: kit.landing.title,
      metaDescription: kit.landing.metaDescription,
      h1: kit.landing.h1,
      lead: kit.landing.lead,
      benefits: kit.landing.benefits.map((b) => ({ ...b })),
      steps: [...kit.landing.steps],
      faq: kit.landing.faq.map((f) => ({ ...f })),
      cta: kit.landing.cta
    }
  };
}

function str(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length >= min && v.length <= max ? v : null;
}

/**
 * Merge AI-reworded copy into a template kit. Returns null — keep the template
 * kit — if anything is missing, mis-shaped, out of bounds, drops a link,
 * repeats a subject, or breaks a copy rule.
 */
export function mergePolishedCopy(kit: CampaignKit, candidate: unknown): CampaignKit | null {
  if (!candidate || typeof candidate !== "object") return null;
  const c = candidate as Record<string, unknown>;
  const pos = c.positioning as Record<string, unknown> | undefined;
  const emails = c.emails;
  const landing = c.landing as Record<string, unknown> | undefined;
  if (!pos || !landing || !Array.isArray(emails) || emails.length !== kit.emails.length) return null;

  const oneLiner = str(pos.oneLiner, 10, 240);
  const problem = str(pos.problem, 10, 400);
  const promise = str(pos.promise, 10, 500);
  if (!oneLiner || !problem || !promise) return null;

  const nextEmails: CampaignEmail[] = [];
  for (let i = 0; i < kit.emails.length; i += 1) {
    const raw = emails[i] as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") return null;
    const subjectA = str(raw.subjectA, 4, 90);
    const subjectB = str(raw.subjectB, 4, 90);
    const preview = str(raw.preview, 4, 140);
    const body = str(raw.body, 40, 4000);
    const ctaLabel = str(raw.ctaLabel, 2, 40);
    if (!subjectA || !subjectB || !preview || !body || !ctaLabel) return null;
    if (subjectA.toLowerCase() === subjectB.toLowerCase()) return null;
    const original = kit.emails[i];
    // The link must survive the rewrite, exactly.
    if (original.ctaUrl && !body.includes(original.ctaUrl)) return null;
    nextEmails.push({ ...original, subjectA, subjectB, preview, body, ctaLabel });
  }

  const title = str(landing.title, 10, 60);
  const metaDescription = str(landing.metaDescription, 120, 165);
  const h1 = str(landing.h1, 6, 120);
  const lead = str(landing.lead, 10, 600);
  const cta = str(landing.cta, 2, 40);
  if (!title || !metaDescription || !h1 || !lead || !cta) return null;

  const benefitsRaw = landing.benefits;
  const stepsRaw = landing.steps;
  const faqRaw = landing.faq;
  if (!Array.isArray(benefitsRaw) || benefitsRaw.length !== kit.landing.benefits.length) return null;
  if (!Array.isArray(stepsRaw) || stepsRaw.length !== kit.landing.steps.length) return null;
  if (!Array.isArray(faqRaw) || faqRaw.length !== kit.landing.faq.length) return null;
  const benefits: Array<{ title: string; body: string }> = [];
  for (const b of benefitsRaw) {
    const r = (b ?? {}) as Record<string, unknown>;
    const t = str(r.title, 2, 60);
    const bd = str(r.body, 6, 300);
    if (!t || !bd) return null;
    benefits.push({ title: t, body: bd });
  }
  const steps: string[] = [];
  for (const s of stepsRaw) {
    const v = str(s, 4, 200);
    if (!v) return null;
    steps.push(v);
  }
  const faq: Array<{ q: string; a: string }> = [];
  for (const f of faqRaw) {
    const r = (f ?? {}) as Record<string, unknown>;
    const q = str(r.q, 4, 160);
    const a = str(r.a, 2, 600);
    if (!q || !a) return null;
    faq.push({ q, a });
  }

  const merged: CampaignKit = {
    ...kit,
    generatedBy: "ai",
    positioning: { oneLiner, problem, promise },
    emails: nextEmails,
    landing: { ...kit.landing, title, metaDescription, h1, lead, benefits, steps, faq, cta }
  };
  return copyProblems(merged).length ? null : merged;
}

// ---------------------------------------------------------------------------
// The first real case
// ---------------------------------------------------------------------------

export const LED_WALL_EXAMPLE: CampaignBrief = {
  company: "United Under God",
  product: "LED walls, stage lighting and sound for church sanctuaries",
  audience: "churches in South Georgia, Florida and South Carolina",
  offer: "Tell us about your room once; three church AV companies bid on the same scope; compare side by side; choose one or none",
  bidders: 3,
  landingUrl: "https://www.unitedundergod.org/church-av/led-wall",
  rules: ["free", "AI", "no installer names", "no prices"]
};
