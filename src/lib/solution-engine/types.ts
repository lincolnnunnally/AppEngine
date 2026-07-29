// Domain types for the Solution Engine. Source of truth for the vocabulary:
// _SOURCE_OF_TRUTH/08_SOLUTION_ENGINE__OWNER_DEFINITION.md in life-produces-life.

// The case journey. LAND → TALK → DIAGNOSE → OFFER → BUILD → DELIVER → CONNECT → FOLLOW-UP.
export const caseStates = [
  "intake", // talking; the diagnostic conversation is running
  "reflected", // the guide has reflected the problem back, waiting for "yes, that's it"
  "diagnosed", // reflection confirmed; triage decided; ready to make an offer
  "offered", // proposal on the table
  "covenant_pending", // chronic track: the commitment screen is waiting for a tap
  "accepted", // they said yes (and signed the covenant if chronic)
  "building", // in the builder lanes
  "delivered_pending_connection", // the thing works; the loop is NOT done
  "connecting", // an intro is drafted/sent
  "connected", // an intro was accepted
  "follow_up", // two-week check-in outstanding
  "closed", // only reachable via the connection rule
  "paused", // stall protocol — door explicitly left open
  "declined", // they refused the covenant; logged, not judged
  "escalated" // safety: out of the solution flow, handed to a human
] as const;

export type CaseState = (typeof caseStates)[number];

export type Triage = "relief" | "development" | "crisis_first" | "escalated";

export type SolutionType = "business_starter" | "personal_tool" | "job_search_kit" | "action_plan";

// The root condition is routing metadata only. It is never rendered to the person.
export type RootClass =
  | "scarcity_focus"
  | "isolation"
  | "crisis_event"
  | "skill_gap"
  | "identity_collapse"
  | "capacity_overload"
  | "unknown";

export type SolutionCase = {
  id: string;
  token: string;
  state: CaseState;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_channel: string | null;
  region: string | null;
  postal_code: string | null;
  stated_problem: string | null;
  functional_problem: string | null;
  root_class: string | null;
  // Matching vocabulary for the connection layer — see connection.ts.
  problem_class: string | null;
  triage: Triage | null;
  triage_signals: TriageSignals;
  triage_decided_at: string | null;
  reflection: string | null;
  reflection_confirmed_at: string | null;
  solution_type: SolutionType | null;
  offer: Offer | null;
  offer_made_at: string | null;
  offer_accepted_at: string | null;
  offer_declined_at: string | null;
  build_ref: string | null;
  build_started_at: string | null;
  promised_for: string | null;
  artifact_url: string | null;
  walkthrough_url: string | null;
  delivered_at: string | null;
  safety_flagged: boolean;
  safety_reason: string | null;
  intro_attempts: number;
  closed_at: string | null;
  paused_at: string | null;
  exchange_count: number;
  anon_id: string | null;
  created_at: string;
  updated_at: string;
};

// What the diagnostic listened for. Kept as evidence so a triage decision can be
// re-read months later — the knowledge layer is the product.
export type TriageSignals = {
  duration?: "new" | "months" | "years" | "unknown";
  soughtHelpBefore?: boolean;
  suddenEvent?: boolean;
  needDescribedAsMoney?: boolean;
  boundedNeed?: boolean;
  firstTimeAsker?: boolean;
  notes?: string[];
};

export type CaseMessage = {
  id: string;
  case_id: string;
  turn_index: number;
  role: "person" | "guide";
  body: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export type Offer = {
  headline: string;
  whatWeBuild: string;
  whatItCosts: string;
  whatYouBring: string | null;
  readyBy: string;
  bullets: string[];
};

export type Covenant = {
  id: string;
  case_id: string;
  we_bring: string[];
  they_bring: string;
  first_step: string;
  cadence: string;
  agreed_at: string | null;
  declined_at: string | null;
  paused_at: string | null;
  created_at: string;
};

export type Commitment = {
  id: string;
  case_id: string;
  covenant_id: string;
  period_index: number;
  description: string;
  due_on: string;
  status: "pending" | "kept" | "missed" | "shrunk";
  responded_at: string | null;
  note: string | null;
  reminder_sent_at: string | null;
  created_at: string;
};

export type PoolMember = {
  id: string;
  display_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  channel: string;
  region: string | null;
  problem_classes: string[];
  stage: "one_step_ahead" | "same_stage";
  source: string;
  story: string | null;
  capacity: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Intro = {
  id: string;
  case_id: string;
  match_id: string | null;
  attempt_number: number;
  state: "drafted" | "sent" | "accepted" | "declined" | "expired";
  draft: string;
  person_confirmed_at: string | null;
  match_confirmed_at: string | null;
  contact_shared_at: string | null;
  declined_at: string | null;
  declined_by: string | null;
  created_at: string;
};

export type FollowUp = {
  id: string;
  case_id: string;
  kind: string;
  due_at: string;
  sent_at: string | null;
  answered_at: string | null;
  still_working: boolean | null;
  still_meeting: boolean | null;
  testimony: string | null;
  created_at: string;
};

export type SafetyEscalation = {
  id: string;
  case_id: string;
  category: string;
  detected_by: string;
  excerpt: string | null;
  notified_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
};

export type KnowledgeRecord = {
  id: string;
  case_id: string;
  stated_problem: string | null;
  functional_problem: string | null;
  root_class: string | null;
  triage: string | null;
  solution_type: string | null;
  build_minutes: number | null;
  intake_to_delivery_hours: number | null;
  usage_at_two_weeks: boolean | null;
  commitment_streak: number | null;
  connection_outcome: string | null;
  testimony: string | null;
  created_at: string;
  updated_at: string;
};
