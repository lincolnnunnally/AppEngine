# Soul Dating App — Spec (DRAFT for source-of-truth)

> **Name decided 2026-07-04: Aligned Souls.** Files keep the soul-dating working slug; the product name is Aligned Souls (domains available at decision time: alignedsouls.app, aligned-souls.com, alignedsoulsdating.com, alignedsouls.dating).
Owner: Lincoln · Drafted 2026-07-03 · Working names: Soulful Dating / Aligned Souls / Soul Connection (final name + domain = Lincoln's call)

> Working title pending Lincoln's name decision; filed under the soul-dating working slug.

## Owner decisions this spec encodes (2026-07-03)

1. **Two separate apps.** Kindred Connections stays friendship-first (local engagement, self-discovery, growth, support groups). Dating is its OWN app — shared components, separate product, separate doctrine lane.
2. **Mission:** help people find a romantic companion who makes them more alive, accepted, loved, honest, purposeful, and able to become who God designed them to be — by knowing people deeply, not by maximizing swipes.
3. **Success metric (golf score):** fewest meaningful match attempts before a relationship strong enough that the person no longer needs dating. 1 match = excellent; endless swiping = failure. The app optimizes for right fit, not activity.
4. **Core pillars:** deep-knowing (right questions/inputs, journaling, imported life context — all opt-in) and **personal growth** — including learning that a hard conversation can be an act of love ("the first time anyone has ever loved them enough to actually have a difficult conversation with them"). Growth is not a feature; it is the retention loop.
5. **Bull's-eye, not swipe:** small sets of high-confidence matches with "why this person" explanations, challenge areas, concerns, and first-conversation suggestions.

## Name + hosting decision (updated 2026-07-04)

**Launch target = `alignedsouls.unitedundergod.org`** (owner decision 2026-07-04): host on a
subdomain of the org domain Lincoln already owns; buy a dedicated domain later. Free, no
purchase needed.

Setup sequence (the subdomain is the LAST step — it can't point at anything until the app
is deployed):
1. Build + deploy the Aligned Souls app to Vercel (forked from migrated Kindred code — see
   the Emergent exodus / Kindred migration pack). This is the real work; the app does not
   run yet.
2. Add `alignedsouls.unitedundergod.org` in the Vercel project's Domains settings.
3. Add one DNS record at **DreamHost** (where unitedundergod.org DNS is managed —
   ns1/ns2/ns3.dreamhost.com; root is a WordPress/PMPro site on 67.205.20.0): a CNAME
   `alignedsouls` → the Vercel target Vercel provides. Owner action (DreamHost login), or
   Claude supplies the exact record to paste.

Dedicated-domain candidates for later (availability checked 2026-07-03, prices/yr):
alignedsouls.app $9.99 · aligned-souls.com $11.25 · alignedsoulsdating.com $11.25 ·
alignedsouls.dating $23.99. Taken: alignedsouls.com.
Note: "Aligned Souls" was Kindred's original Emergent project name (aligned-souls.* hosts);
Kindred still lives at aligned-souls.emergent.host until it is re-hosted, so keep the
subdomain (unitedundergod.org) distinct from Kindred's hosting until that migration lands.

## Composition — build almost nothing from scratch (THE ONE RULE)

| Need (from the build ledger) | Source | Status |
|---|---|---|
| Compatibility/matching/assessment | `connection-engine` block (Kindred `soul_match.py`, `relational_posture.py`, `pods.py`) — romance-tuned weights are a CONFIG, not a rebuild. Depends on **ECO-008** (shared Connection engine extraction, still AVAILABLE) | exists |
| Match readiness score | Kindred readiness + Relational Posture compass (anchored/tender/guarded/whirling) + the existing "soulful pause" dialog — this IS the readiness mechanic, already built | exists |
| Guided mutual discovery | **The Knowing** (7-day mutual prompts, both-answer-then-reveal) — practically the dating app's structured first-conversation feature | exists |
| Private journal + reflection | `becoming-growth-dashboard` (becoming.py, Journal.js); date-reflection prompts are new content, not new plumbing | exists |
| Growth/hard-conversations pillar | Identity Pathway, Coaching w/ covenants, Forgiveness Path (forgiveness ≠ reconciliation; release/boundary/repair equal), mediated-communication block (childfirst) | exists |
| Location/distance matching | **location-proximity module (ECO-010, this week)** — person rows floored at city visibility; distance BANDS only between people | built (staged) |
| Messaging + icebreakers | `communication` block + Kindred Smart Icebreakers + Soul-Match "why we paired you" prose | exists |
| Safety/report/block/admin | `admin-ops-moderation` (Kindred admin.py) + Safety net (trusted-friend SOS) + built-in admin standard | exists |
| Photos, ID verification, scenario quizzes, match-explanation engine, consent center | partial blocks — the six known catalog gaps; schedule after location module | partial |
| Auth, billing (freemium/credits), analytics/ops | AppEngine NextAuth scaffold or Supabase GoTrue; dormant billing stack (BILLING_PLAN.md); ops collector (PR #245) | exists |

## Romantic Compatibility Engine v1 (designed 2026-07-03, per Lincoln's direction)

Grounded in the real code: Kindred's person↔person `compatibility_score` (core.py:392) is
set-overlap similarity only (values ×12, goals ×10, interests ×4, clamped 35–99). Its
event scorer `_score_event_for_user` (events.py:292) is the architecture to extend:
deterministic axis functions + weights + 1-2 plain-English reasons, no LLM cost per score.
The romantic engine keeps that shape and adds what romance actually needs.

### Pipeline (each stage cheap, deterministic; LLM only for final prose)

**Stage 0 — Hard filters (never scored, never softened):** dealbreakers, orientation/
gender preference, marriage/children intent conflicts, radius (ECO-010 — bands only
between people), safety exclusions, blocked sets, and the faith-centrality band gate:
the four bands (center / important-growing / background / exploring) match within ±1
band; a >1-band gap excludes (admin-tunable — proposed default, owner may loosen).
Users whose band shrinks their pool (e.g. "exploring" in a faith-centered base) get
honest copy at their first match screen — a smaller pool is explained, never silent.

**Stage 1 — Alignment (similarity axes, admin-weighted):** faith centrality, core values
(reuse the overlap logic), mission/purpose, family timeline, lifestyle. "We want the same
life."

**Stage 2 — Complementarity (cross-terms — the new math similarity can't do):**
- **Love languages as give↔receive asymmetry.** Assess three things per person: how I
  naturally GIVE love, how I best RECEIVE love, and which language I actually respond to
  in practice (observed, not just claimed). Score bidirectionally: A.give→B.receive AND
  B.give→A.receive. One-directional mesh is a coaching flag ("you may need to ask for
  words, not gifts"), not a zero.
  Mechanics (v1): each person carries full 5-dimension GIVE and RECEIVE vectors,
  normalized, with reverse-scored negatives floored at 0 before matching;
  mesh(A→B) = cosine(A.give, B.receive), where the GIVE vector up-weights the
  tired-season ("sustainable give") item ×1.25 until journal data validates it. A
  repair-context give that matches the partner's receive language earns a 1.5× bonus on
  this axis — repair moments are where languages matter most. Users confirm the displayed
  top-2 labels per vector before the profile affects matching; a rejection triggers one
  adaptive re-ask, never silent truncation of the stored vector. (This deliberately
  extends the ledger's confirm-before-matching rule from inferred traits to
  scenario-derived profiles.)
- **Inferred expression language.** Which love language a person MESSAGES with — words of
  affirmation show up literally in text; quality-time planning, acts-of-service offers,
  and gift language partially. Inferred from messages/journals/Knowing answers, opt-in,
  private by default, and (ledger rule) the user must confirm any inferred insight before
  it affects matching.
- **Conflict style + relational posture pairing.** Reuse the Posture compass
  (anchored/tender/guarded/whirling): guarded+guarded suggests slower pacing (affects
  conversation prompts, not exclusion); volatile+avoidant patterns flag as "where you may
  challenge each other."
- Honest note: the love-languages framework is popular but psychometrically debated —
  treat it as a communication-preference lens, ONE weighted axis (admin-tunable), and let
  the reflection journal validate it per-couple empirically. "Did I feel loved around
  this person" outranks theory.

**Stage 3 — Learned attraction (the X-factor, treated as data, not questionnaire):**
Most people date on reaction — charming, funny, caring, spontaneous — without
understanding it. Don't fight that with a 200-item assessment; LEARN it:
- Date-reflection journal is the primary sensor (already in the ledger): "what attracted
  me?" as quick chips (funny/charming/caring/spontaneous/thoughtful/steady/…) + optional
  free text; "did I feel more alive or drained?"
- Passive signals: which "why we paired you" cards convert to intro requests vs passes.
- Output is a per-user learned attraction profile surfaced BACK to the user as insight
  ("you consistently feel alive around playful people and drained by intensity") — the
  deep-knowing pillar means helping people understand their reactions, not being ruled by
  them. Cold start: max 3 attraction chips in the quick path; everything else earned.

**Stage 4 — Confidence + explanation:** every axis tracks coverage (how much do we
actually know about both people?). Score and confidence are separate numbers; low-data
matches show honestly as "early — improves as we learn." Reasons come from the axis
functions (events.py pattern); Claude writes the final prose card ("why we paired you,"
where you align, where you'll challenge each other, first-conversation starters) only for
the small final set — the Soul Match Sunday cost pattern.

### The friction budget (the failure mode to design against)

"Too much work with too few results" kills it. Rules:
1. **Quick path ≤ ~12 questions / ~3 minutes → first matches the same session**, labeled
   low-confidence. Value before labor.
2. **Progressive profiling, never walls.** One micro-question at natural moments (after
   viewing a match, after a reflection, new day) — always skippable, capped daily.
   Love-language assessment = 6–8 single-pick scenario items ("which would land
   deepest"), not a 40-item Likert battery — single-pick over ranking keeps every item
   one tap; give-side items separate and equally short. The same items may drip through
   this micro-question channel instead of running as a block.
3. **Every question visibly pays.** Each answer moves the user's own Match Readiness /
   confidence meter immediately and names the axis it improved ("this sharpens how we
   read what makes you feel loved").
4. **The reflection journal is the main engine.** Five taps + optional free text after an
   interaction; each entry quietly updates learned axes. People will do 30 seconds of
   feeling-naming after a date; they will not do homework.

### Where it's built

Extends the Connection Engine (the ECO-008 extraction packet should list romance-config
requirements so the shared engine exposes axis plug-ins); new pieces: `romance-scoring`
config (axes/weights/cross-terms), love-language scenario assessment (extends the
assessment block), reflection→matching feedback service. Deterministic core, LLM at the
edges — same cost discipline as Kindred today.

## The Alignment Model — the Relationship Sweet Spot (designed 2026-07-03)

Kindred already implements personal ikigai: `becoming.py:185` ("Sweet Spot (ikigai)")
computes talents / passions / world-needs / livelihood → a sweet-spot calling statement,
framed through Ephesians 2:10. The dating app extends the SAME model from "where you
thrive" to "where the two of you thrive." This is the app's organizing picture — every
assessment, journal insight, and match explanation hangs off it.

### The four circles (couple ikigai)

1. **ALIVENESS — you enjoy each other.** Play, humor, energy, adventure, shared
   interests, attraction. The reaction layer people currently date on — kept, but made
   one circle instead of the whole picture.
2. **FORMATION — you're good FOR each other.** How you love (give↔receive), how you
   fight and repair, how you grow each other, whether you can hear a hard, loving
   conversation from this person. Lincoln's growth pillar lives here.
3. **CALLING — the world needs the two of you.** Faith, mission, purpose direction,
   service. A union that points beyond itself.
4. **PROVISION — life can be built on it.** Money styles, responsibility, family plans,
   location, health rhythms. The unglamorous circle six-month heartbreaks are made of.

The pairwise gaps are the diagnosis vocabulary the app uses in match cards and
reflections: Aliveness+Formation without Calling/Provision = "a great romance that goes
nowhere." Formation+Calling without Aliveness = "noble but joyless." Calling+Provision
without Formation = "co-workers, not lovers." Provision+Aliveness without Calling =
"pleasant but hollow." **Center = the Relationship Sweet Spot** — a person with whom you
become more alive, more loving, more purposeful, and more able to build a life. (This is
the mission statement, made drawable — the UI should literally render the four-circle
diagram per match, shaded by evidence.)

### The dimension taxonomy (v1 — the canonical axis list)

Legend — Score: S similarity · C complementarity cross-term · E band (distance within
personal tolerance) · GATE dealbreaker-capable. Source: Q quick path · Sc scenario
assessment · In inferred (user-confirmed) · J journal-learned. Circle: A/F/C/P.

| # | Axis | Domain | Score | Source | Circle | Weight |
|---|------|--------|-------|--------|--------|--------|
| 1 | Faith centrality | Soul & Belief | S | Q | C | GATE/H |
| 2 | Belief system / tradition comfort | Soul & Belief | S | Q | C | GATE-capable |
| 3 | Spiritual practice rhythm | Soul & Belief | E | Sc | C | M |
| 4 | Mission / purpose direction (Soul Read) | Soul & Belief | S | Q (exists) | C | H |
| 5 | Openness / growth mindset | Character | S | Sc | F | H |
| 6 | Responsibility ↔ spontaneity | Character | E | Sc | F/A | H |
| 7 | Honesty / humility | Character | S | Sc+J | F | H |
| 8 | Forgiveness / repair pattern | Character | S | Sc (Forgiveness Path exists) | F | H |
| 9 | Love language — GIVE | Love & Connection | C | Sc | F | H |
| 10 | Love language — RECEIVE | Love & Connection | C | Sc | F | H |
| 11 | Love style / attachment tendency | Love & Connection | E + flags | Sc | F | H |
| 12 | Emotional needs & pace | Love & Connection | E | Sc+J | F | M |
| 13 | Relational posture (exists) | Love & Connection | C-pairing | exists | F | M |
| 14 | Communication directness | Comm & Conflict | E | Sc+In | F | H |
| 15 | Conflict style | Comm & Conflict | C + risk flags | Sc | F | H |
| 16 | Hard-conversation capacity | Comm & Conflict | S | Sc+J | F | H |
| 17 | Energy level | Life Rhythm | E | Q | A | M |
| 18 | Social battery (intro/extrovert) | Life Rhythm | E | Q | A | M |
| 19 | Indoors ↔ outdoors | Life Rhythm | E | Q | A | M |
| 20 | Adventure ↔ rootedness | Life Rhythm | S | Sc | A | M |
| 21 | Money style (spender/saver/steward) | Practical | E + flags | Sc | P | H |
| 22 | Ambition / work rhythm | Practical | E | Sc | P | M |
| 23 | Household responsibility expectations | Practical | S/E | Sc | P | M |
| 24 | Health / lifestyle habits | Practical | S | Q | P | M |
| 25 | Marriage timeline | Family & Future | S | Q | P | GATE |
| 26 | Children desire | Family & Future | S | Q | P | GATE |
| 27 | Parenting beliefs | Family & Future | S | Sc | P | H |
| 28 | Location / rootedness (ECO-010) | Family & Future | S | Q | P | GATE-capable |
| 29 | Learned attraction profile (X-factor) | Vitality | learned | J+In | A | M→H over time |
| 30 | Play / humor mesh | Vitality | In/J | In+J | A | M |

Physical-attraction preferences stay a **gate, not a score** — mutual-attraction
possibility is filtered, never ranked (the app matches souls, but doesn't pretend bodies
don't exist).

### How the taxonomy respects the friction budget

The quick path only carries the GATEs + ~6 Q-source axes (≈12 questions → same-session
matches). Scenario assessments (Sc) unlock progressively as micro-questions — each names
which circle it sharpens and visibly moves the confidence meter. In/J axes cost the user
nothing: they accrue from messaging, reflections, and The Knowing, always shown for
confirmation before affecting matching. This solves the actual problem people face — six
months discovering misalignment — by front-loading the gates and the heavy Formation/
Provision axes, and letting Aliveness prove itself through lived reflection instead of
questionnaires.

### What it powers

- **Per-match sweet-spot diagram** (four circles, shaded by evidence + confidence) with
  the pairwise-gap vocabulary as honest concerns ("strong Aliveness + Formation; Provision
  unknown — money styles haven't been explored yet").
- **The engine's axes** (previous section) — the taxonomy is the canonical axis registry
  the admin weight table operates on.
- **Personal insight track** — the same data renders each user's OWN growth picture
  (deep-knowing pillar), so assessment effort pays even before any match.

## Doctrine note (still owed)

The ecosystem SoT (01_ECOSYSTEM_MAP, Kindred section) still reads "friendship, not romance — the false fix." Lincoln's 2026-07-03 direction (separate dating app addressing the level "that only a romantic partner can satisfy," with growth + readiness built in) needs to land as a short amendment in the SoT repo before the app takes a board slot. Draft language: keep Kindred's friendship-first doctrine intact; add that romantic connection is a REAL need the ecosystem now serves deliberately — with readiness, honesty, and growth safeguards — in a dedicated app, not by re-romanticizing Kindred.

## Sequencing (respects the queue + migrations)

1. ECO-010 location module (in review) → apply schema 🔒.
2. ECO-008 Connection-engine extraction packet (unblocks both Kindred vNext and dating).
3. Kindred Emergent exodus (PR #1 doc pack → gates) — dating app consumes the post-migration `kindred_*`/person-first plane and Supabase Auth/Storage recipes.
4. Dating app MVP slice (per the build ledger's Sprint 1–4: shell/auth/profile → quick assessment + dealbreakers → matching v1 + explanations → reflection journal feedback loop) in its OWN repo, on the shared LPL Supabase, free-tier hosting until Lincoln approves paid.
5. Board entries: portfolio row + ECO-011 + spine TASK issue when Lincoln green-lights the doctrine amendment + name.

## Open for Lincoln

D1 doctrine amendment text · D2 name + domain purchase · D3 queue position vs ChurchConnect/ChildFirst/etc. · D4 free-at-launch vs paid (Vercel Pro + Stripe implications) · D5 whether The Knowing/Forgiveness surfaces ship in dating v1 or later.
