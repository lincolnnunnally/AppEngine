# Soul Dating — Quick Path & Love-Language Scenario Bank (v1.1)

Companion to `soul-dating-app-spec.md`. Owner: Lincoln · 2026-07-04 · Status: DRAFT for
owner review (v1.1 — revised after adversarial review; scoring rules made implementable)

Design constraint (owner, verbatim intent): *"not bogging them down with 1 million
questions and causing them to want to quit because it's too much work with too few
results."* Every item below must either gate a match, score an axis, or improve the
engine's confidence — and several items feed multiple axes. Nothing here is a
personality quiz for its own sake.

Friction budget, stated honestly: **12 questions across 14 screens → first matches the
same session.** The two non-question screens are photos and attraction preferences —
required because mutual-attraction possibility is a Stage-0 gate in the parent spec (a
gate cannot run on data we never collected). The scenario bank (8 items) is optional,
offered *after* first matches exist, as a ~3-minute block **or** dripped one-at-a-time
through the micro-question channel (spec friction rule 2) — user's choice.

---

## Part 1 — Quick Path (12 questions, 14 screens)

Q1–Q6 are gates and identity (fast form fields). P1–P2 are the attraction screens.
Q7–Q12 are the soul snapshot — one tap each, written to feel like self-discovery, not
an exam. Axis codes reference the taxonomy in `soul-dating-app-spec.md`; quick-path
answers on scenario-sourced axes are recorded as **low-confidence seeds (source:
Q-seed)** that the scenario bank and journal later refine — they never masquerade as
full-confidence axis scores.

| # | Screen | Options | Captures |
|---|---|---|---|
| Q1 | Basics — name, age, gender, seeking (one screen, four fields) | form | identity; hard filter |
| Q2 | Location — device opt-in or ZIP. Copy: "Others only ever see a distance range like '5–10 mi' — never your location." | opt-in / ZIP / skip | GATE-location; privacy consent (location-proximity module contract) |
| Q3 | "Where does faith sit in your life right now?" | the center of everything · important and growing · in the background · exploring honestly | GATE-faith band (±1 band matches, >1 excludes — Stage 0; admin-tunable). Honest-pool copy: an "exploring" user in a faith-centered base sees "your pool is smaller here, and here's why" at the first match screen — never a silent empty feed |
| Q4 | "What are you hoping to find?" | marriage-minded — ready within a couple of years · a serious relationship, marriage when it's right · dating seriously, still discerning | GATE-marriage-timeline + intent axis |
| Q5 | "Kids?" | want children · have kids, open to more · have kids, done · don't want children · genuinely open | GATE-children (bidirectional) |
| Q6 | Dealbreakers — "Anything that's simply a no for you?" (one-tap chips only) | smoking · drinks-heavily · long-distance · kids-at-home · divorce history | hard exclusions (engine never overrides). Denominational boundaries moved to a post-match micro-question — too heavy for a chip screen |
| P1 | Photos (1 required to be matchable, up to 4) | upload | attraction gate input; moderation pipeline |
| P2 | Attraction — "What tends to catch you?" (max 3 chips, spec cold-start rule) + basic preference ranges | chips + ranges | GATE-mutual-attraction possibility (filtered, never ranked — spec rule) |
| Q7 | "When you care about someone, what do you *naturally* do?" | show up and help before they ask · tell them exactly what they mean to you · find the perfect small gift · clear your calendar for them · reach for their hand | **LL-give seed** (also the GIVE tie-breaker, below) |
| Q8 | "What lands deepest when someone loves *you* well?" | they lighten my load · they say what they see in me · a gift that proves they listen · unhurried time, no phones · warm, unforced affection | **LL-receive seed** |
| Q9 | "Your ideal Saturday together?" | out in creation — trail, water, sky · quiet at home, slow morning · out with people we love · serving somewhere side-by-side · no plan — see where the day goes | Scores ONLY what the chosen option cleanly loads (1–2 axes; others stay null so coverage stays honest): creation→outdoor; home→indoor+lower-social; people→higher-social; serving→service posture; no-plan→spontaneity. Q-seed |
| Q10 | "When something's wrong between you two, you tend to…" | name it right away, kindly · need a little time, then talk it through · keep the peace and hope it passes · write it out before I can say it | conflict-style Q-seed (scenario-refined per taxonomy; complementarity handled at the engine, per spec Stage 2) |
| Q11 | "With money, you're honestly more…" | planner — budgets bring me peace · generous — money is for blessing people · builder — investing in what's next · avoider — I'd rather not look | money-posture Q-seed (band match; avoider×avoider flagged as friction, not filtered) |
| Q12 | "A partner you trust lovingly points out a blind spot. You…" | want that — that's what love does · can hear it once trust runs deep · flinch, but I'm working on it | teachability / hard-conversations Q-seed — the app's core growth pillar (proposed as a top-weight axis; weight is admin-set, owner to confirm) |

Coverage math: 4 gates + dealbreakers + attraction gate inputs + LL seeds + 7 seeded
axes. First matches ship the same session labeled low-confidence ("early — improves as
we learn," spec Stage 4); the numeric confidence formula is defined at engine
implementation, not here. Taxonomy gaps deferred to progressive profiling: energy
level (axis 17) and health/lifestyle habits (axis 24) arrive as micro-questions, not
quick-path screens.

Copy rule: every option is written so no answer feels like the "wrong" one —
self-report honesty collapses the moment an option sounds shameful (Q11 "avoider" is
phrased with dignity on purpose). Where an answer has a real pool consequence (Q3),
the consequence is *explained*, because a silent thin feed is the same quit-path as
too many questions.

---

## Part 2 — Love-Language Scenario Bank (8 items, ~3 minutes)

**Why scenarios:** self-reported love languages skew aspirational — people pick who
they wish they were. The five love languages are treated as a **give vector** and a
**receive vector** (provably different per person), measured *indirectly*: instincts,
absences, and costs — not labels.

**Scoring rules (implementable, one reading only):**
- Positive items: the chosen option adds **+2** to that language on the item's vector.
- **S3 (absence stings)** is a positive-loading miss-detection item: **+2 RECEIVE**,
  and miss-detection carries a **×1.25** weight (highest-signal format) → +2.5.
- **S5 (falls flat)** is reverse-scored: **−1 RECEIVE** on the chosen language. It is
  −1, not −2, and the miss weight does NOT apply — one flat exemplar must never cancel
  a full positive signal.
- **S8 (tired-season give)** is the "sustainable give" item: **+2 GIVE ×1.25** until
  the reflection journal validates sustainability empirically (Sprint 4 loop), at
  which point observed data replaces the up-weight.
- No option splits across languages anywhere in the bank — every language accrues
  through exactly one path per item, so no language gets a structural bonus.
- Vectors are stored full 5-dimension, normalized, negatives floored at 0 — per the
  engine mechanics in `soul-dating-app-spec.md` Stage 2.

**GIVE coverage & ties:** four give items (S2 celebrate · S4 repair · S7 ordinary-day
· S8 tired-season) + the Q7 seed. Ties in the top-2 are broken by the Q7 seed; if
still tied, one adaptive follow-up is asked; per-vector confidence reflects any
unresolved tie.

- **S1 · receive/restore** — "It's been a brutal week. Which of these from your person would actually restore you?" → they quietly take something off your plate (acts) · a message naming exactly what they see in you (words) · a small gift that proves they were listening weeks ago (gifts) · a whole evening of unhurried attention (time) · a long hug, no words needed (touch)
- **S2 · give/celebrate** — "Your person just got the best news of their year. Your first instinct?" → clear the whole evening to celebrate, just you two (time) · tell them — and everyone — why you're proud (words) · get the thing they've been eyeing forever (gifts) · sweep them up, spin them around (touch) · handle everything tonight so they can just enjoy it (acts)
- **S3 · receive/miss (×1.25)** — "A month in, which absence would quietly sting the most?" → they never say what they feel about you (words) · they never plan time for just you two (time) · they never reach for your hand (touch) · they never offer help when you're drowning (acts) · they never mark moments — no small somethings (gifts)
- **S4 · give/repair** — "You two had a tense morning; it isn't resolved yet. Before talking, you'd most likely…" → quietly do something that makes their day easier (acts) · send a message with your heart in it (words) · suggest a walk, just you two (time) · leave a small peace offering where they'll find it (gifts) · sit close, reach out first (touch). *Repair-context gives feed the engine's 1.5× repair bonus (spec Stage 2) — repair moments are where languages matter most.*
- **S5 · receive/flat (reverse, −1)** — "Which well-meant gesture honestly does the least for you?" → they handle a chore you never asked about (acts) · spoken encouragement (words) · a thoughtful little gift (gifts) · a planned evening together (time) · casual affection through the day (touch). *Exemplars deliberately match the positive items' specificity and carry no gendered cliché, so the −1 lands on the language, not the example.*
- **S6 · receive/history** — "Think of a time you felt most loved — by anyone, not just romance. What was happening?" → someone stayed when it was inconvenient (time) · someone said the thing you needed to hear (words) · someone just handled it for you (acts) · someone held you / stayed physically close (touch) · someone gave you something that said *I know you* (gifts)
- **S7 · give/ordinary-day** — "It's a completely ordinary Tuesday. With someone you love, you're most likely to…" → text them the thing you appreciated about them today (words) · pick up their favorite small something on the way home (gifts) · knock an errand off their list without mentioning it (acts) · suggest an evening walk, just you two (time) · sit close on the couch, no agenda (touch)
- **S8 · give/tired-season (×1.25)** — "It's 9pm after a brutal day. Which do you still *reliably* do?" → still handle the dishes so tomorrow is lighter (acts) · still say the encouraging thing out loud (words) · still sit with them, phone away (time) · still reach over — a hand on the shoulder (touch) · still grab the little thing that made you think of them (gifts). *A concrete cost scenario, not a label list — the bank's own thesis applied to its highest-weighted give item.*

**Output profile:** full GIVE and RECEIVE vectors (stored), displayed to the user as
top-2 per vector with per-vector confidence. **User confirmation is mandatory:**
"Here's what we noticed — did we get you right?" A rejection triggers one adaptive
re-ask; it never silently truncates the stored vector. Scenario answers are direct
self-reports, not inferences — the parent spec deliberately extends its
confirm-before-matching rule to cover them (spec Stage 2 mechanics).

**Engine cross-match (mesh):** `mesh(A→B) = cosine(A.give, B.receive)` on the full
normalized vectors (spec Stage 2) — computed both directions, surfaced as
plain-English match reasons: *"The way you naturally love (acts) is exactly how she
receives it best"* — and its inverse powers the "where you may challenge each other"
honesty card: *"He feels loved through words — that's your quietest language. Worth
knowing early."*

---

## Sequencing note

Quick path ships in MVP Sprint 2 (`connection-engine` + `purpose-onboarding` catalog
blocks exist; only the item content above is new). **Sprint 3 matching runs
love-language as Q-seed-only, low-confidence** — labeled as such on match cards. The
scenario bank ships Sprint 4 alongside the reflection journal, whose observed data
(post-date "did you feel loved/seen?") gradually corrects both vectors — the X-factor
learning loop from the spec.
