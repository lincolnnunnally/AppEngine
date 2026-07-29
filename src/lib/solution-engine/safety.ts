// §4d — safety escalation. Non-negotiable.
//
// This screen is DETERMINISTIC and runs on every single thing a person types,
// before any model sees it and regardless of whether a model is reachable. The
// language model may raise a flag too, but it may never be the only thing
// standing between someone in danger and a human — so the guarantee lives here.
//
// Design bias: this screen fails toward escalation. A false positive costs one
// person a slightly awkward screen with real phone numbers on it. A false
// negative costs something we cannot buy back.

export type SafetyCategory =
  | "self_harm"
  | "harm_to_others"
  | "abuse"
  | "medical_crisis"
  | "mental_health_crisis"
  | "substance_crisis";

export type SafetyHit = {
  category: SafetyCategory;
  excerpt: string;
  pattern: string;
};

type Rule = {
  category: SafetyCategory;
  patterns: RegExp[];
};

// Idioms that use crisis words but are not crisis language. Checked before the
// rules so "this commute is killing me" doesn't trip an escalation.
const idioms: RegExp[] = [
  /\bkilling me\b/i,
  /\bkills me\b/i,
  /\bdying to\b/i,
  /\bdead tired\b/i,
  /\bdying laughing\b/i,
  /\bkill(?:ing)? time\b/i,
  /\bmurder(?:ed|ing)? (?:that|this|it)\b/i,
  /\bdead(?:line|lines)\b/i
];

const rules: Rule[] = [
  {
    category: "self_harm",
    patterns: [
      /\bkill (?:myself|my self)\b/i,
      /\bkilling myself\b/i,
      /\bend (?:my|it all|my own) (?:life|life\b)?/i,
      /\bend it all\b/i,
      /\btake my (?:own )?life\b/i,
      /\bsuicid(?:e|al)\b/i,
      /\bself[- ]harm\b/i,
      /\bcut(?:ting)? myself\b/i,
      /\bhurt myself\b/i,
      /\bdon'?t want to (?:be here|live|wake up)\b/i,
      /\bbetter off (?:dead|without me)\b/i,
      /\bno reason to (?:live|go on|keep going)\b/i,
      /\bwant to die\b/i,
      /\boverdose\b/i
    ]
  },
  {
    category: "harm_to_others",
    patterns: [
      /\bkill (?:him|her|them|someone|somebody|my (?:wife|husband|partner|boss|ex))\b/i,
      /\bhurt (?:him|her|them|someone|somebody|my kids|my children)\b/i,
      /\bshoot (?:him|her|them|up|someone|somebody)\b/i,
      /\bmake (?:him|her|them) pay\b/i,
      /\bgoing to snap\b/i
    ]
  },
  {
    category: "abuse",
    patterns: [
      /\b(?:he|she|they|my (?:husband|wife|partner|boyfriend|girlfriend|dad|father|mom|mother|ex))\s+(?:hits|hit|beats|beat|chokes|choked|strangl\w*)\s+me\b/i,
      /\bdomestic (?:violence|abuse)\b/i,
      /\bbeing abused\b/i,
      /\bafraid (?:of|for) my (?:life|safety)\b/i,
      /\bnot safe (?:at home|in my home|here)\b/i,
      /\bhe (?:won'?t|will not) let me leave\b/i,
      /\bsexual(?:ly)? assault\w*\b/i,
      /\bhuman traffick\w*\b/i,
      /\b(?:child|kid) (?:is being )?(?:abused|molested)\b/i
    ]
  },
  {
    category: "medical_crisis",
    patterns: [
      /\bchest pain\b/i,
      /\bcan'?t breathe\b/i,
      /\bbleeding (?:badly|out|won'?t stop)\b/i,
      /\bstroke (?:right now|happening)\b/i,
      /\bheart attack\b/i,
      /\bin the (?:er|emergency room) (?:right )?now\b/i
    ]
  },
  {
    category: "mental_health_crisis",
    patterns: [
      /\bpanic attack(?:s)? (?:right now|every day|all day)\b/i,
      /\bhearing voices\b/i,
      /\bcan'?t stop crying\b/i,
      /\bhaven'?t (?:slept|eaten) in (?:days|a week)\b/i,
      /\bpsych(?:iatric)? (?:ward|hold)\b/i,
      /\bmental breakdown\b/i
    ]
  },
  {
    category: "substance_crisis",
    patterns: [
      /\brelapsed?\b/i,
      /\bwithdraw(?:al|ing) from (?:alcohol|heroin|opioids|fentanyl|meth)\b/i,
      /\bcan'?t stop (?:drinking|using)\b/i,
      /\bdetox(?:ing)?\b/i
    ]
  }
];

function stripIdioms(text: string): string {
  return idioms.reduce((carry, idiom) => carry.replace(idiom, " "), text);
}

export function screenForSafety(text: string): SafetyHit | null {
  if (!text || !text.trim()) {
    return null;
  }

  const cleaned = stripIdioms(text);

  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const match = cleaned.match(pattern);

      if (match) {
        return {
          category: rule.category,
          excerpt: excerptAround(text, match.index ?? 0),
          pattern: pattern.source
        };
      }
    }
  }

  return null;
}

function excerptAround(text: string, index: number, radius = 120): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  const slice = text.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

export type CrisisResource = {
  name: string;
  contact: string;
  detail: string;
};

// D-S3 default (owner decision pending): national resources. A named local or
// church partner slots in here when Lincoln designates one.
const nationalResources: CrisisResource[] = [
  {
    name: "988 Suicide & Crisis Lifeline",
    contact: "Call or text 988",
    detail: "Free, confidential, 24/7. For you or for someone you're worried about."
  },
  {
    name: "Crisis Text Line",
    contact: "Text HOME to 741741",
    detail: "A trained crisis counselor, by text, any hour."
  },
  {
    name: "National Domestic Violence Hotline",
    contact: "Call 1-800-799-7233 or text START to 88788",
    detail: "Confidential support and safety planning, 24/7."
  },
  {
    name: "Emergency services",
    contact: "Call 911",
    detail: "If someone is in immediate danger, this is the right call."
  }
];

export function getCrisisResources(category: SafetyCategory): CrisisResource[] {
  if (category === "medical_crisis") {
    return [nationalResources[3], nationalResources[0]];
  }

  if (category === "abuse") {
    return [nationalResources[2], nationalResources[3], nationalResources[1]];
  }

  return nationalResources;
}

// What the person reads. No diagnosis, no jargon, no solution talk — the flow has
// stopped and a human takes it from here.
export function getEscalationMessage(category: SafetyCategory): string {
  if (category === "abuse") {
    return "I'm going to stop here, because what you just described matters more than anything I could build. Please reach out to one of these — they're free, confidential, and there right now.";
  }

  if (category === "medical_crisis") {
    return "Please stop reading this and get help right now. This is more urgent than anything we were about to work on.";
  }

  return "I'm going to stop here. What you just said matters more than anything I could build for you, and you deserve a real person — right now, not Thursday. Please reach out to one of these.";
}
