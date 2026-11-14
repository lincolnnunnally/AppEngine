# Personal Exploration & Growth-Discernment Engine

**Status:** Source-of-truth design doc (v2 — critic-hardened). For owner review before build.
**Module home:** `connection-engine` + `becoming-growth-dashboard` + `purpose-onboarding` in the AppEngine module catalog (`src/lib/engine/module-catalog.ts`). This doc defines a shared **Discernment Core** those blocks compose against, plus a mandatory **Safety Gate** that wraps every user-facing path.
**Serves five apps:** Kindred Connections (friendship), Aligned Souls (dating), Rebuilding Dads / Kids-Need-Dads (fatherhood), Community Connections / Live-on-Mission (belonging), ChurchConnect (discipleship).
**Extends, does not replace:** Kindred's existing soul-read, relational posture, readiness, identity journey, becoming/alignment, and covenant loops. Every existing field is a *seed signal* here, not something to throw away.

**Provenance note (read first).** Every Kindred code claim in this doc has been verified against the real source at `/Users/lincolnnunnally/Documents/Kindred Connections/backend/` (the canonical repo per the mining audit; this is a *different* repo from AppEngine). Each load-bearing claim carries a `file:line` citation. Claims sourced only from the module-catalog `primarySource` pointer strings — not yet opened — are explicitly marked `[pointer-only]`. §9 (limits) restates which mappings remain unverified. The owner should not approve a data-model delta against any field not carrying a verified citation here.

---

## 0. Thesis and the one honest constraint

The product promise is: **the app truly discerns who a person is — mindset vs. heartset, fears, stage of change, what they need next — meets them in a non-linear journey, and adaptively balances challenge and reward toward flow, not addiction.** The failure mode we are explicitly building against is the shallow, vibe-coded quiz: a 200-item Likert wall that outputs a fixed "type," claims more than the data supports, and never changes.

The single most important research finding, repeated across every stream, disciplines the whole design:

> **These are states-in-context, not traits to be labeled.** Dweck's own reckoning (the "false growth mindset" correction; the Sisk et al. 2018 meta-analysis at r≈.09 overall; the Yeager et al. 2019 *Nature* RCT where a light-touch mindset intervention moved grades only where the surrounding climate rewarded trying) says growth is **Person × Context**, non-linear, moment-to-moment. TTM (Prochaska & DiClemente) says people cycle and relapse. Polyvagal and attachment work say posture shifts with felt safety. Christian formation traditions (Willard; the LifeWay *Transformational Discipleship* 8 signposts; Discipleship Dynamics) say maturity is multidimensional and never a single moving-but-not number.

So the engine's prime directives are:

1. **Never output a type. Output positions on continuous dimensions, with uncertainty bands, re-estimated over time.** A "maturity score" that does not move is both psychometrically wrong and pastorally harmful.
2. **Assess the state, re-assess often, and design the context.** The social/faith-community layer is not decoration — the research says it is the *moderator* that makes any of the inner work "take."
3. **Behavior is evidence; self-report is a claim.** The core new capability Kindred lacks is *triangulation*: watching what a person actually does against what they say, and computing *trajectory* (deltas) — which Kindred stores but never analyzes.
4. **Faith is present and integrable, but the science is kept honest and separable from doctrine.** One substrate, a posture dial for the surface language (§7); doctrine is owner-owned and never invented here.
5. **Safety is a precondition, not a feature.** No deep psychological signal is processed into "growth steps" before it clears a risk layer (§8). This is the one place where the engine's normal logic is bypassed.

---

## 1. The dimensional model

Ten dimensions. Each is a **latent construct** estimated as a point + uncertainty band on a continuous scale, tagged with a **domain** (this is not global — mindset "about my temper" ≠ mindset "about my prayer life"), a **confidence** (how much triangulated evidence backs it), and a **freshness** (when last updated). Every dimension maps to a named framework and, where it exists, to the verified Kindred field it extends.

| # | Dimension | What it discerns | Grounding framework | Extends (Kindred, verified) |
|---|-----------|------------------|---------------------|-----------------------------|
| 1 | **Mindset (malleability belief)** | fixed ↔ growth, *per domain* | Dweck implicit theories; scoped honestly per Sisk 2018 / Yeager 2019 | *(new)* — soul-read `growth_goals` (`core.py:397`) is downstream of this, not a measure of it |
| 2 | **Orientation (approach ↔ avoidance)** | "growth mindset" vs. "fear mindset" | Gray RST (BIS/BAS); Elliot & McGregor 2×2 achievement goals; Carver & White scales | *(new)* — the true instrument behind the owner's "fear mindset" |
| 3 | **Explanatory style** | optimistic ↔ pessimistic; internal/stable/global attributions | Abramson–Seligman reformulated learned-helplessness; ASQ/CAVE | *(new)* — the deep root under "frozen in fear" |
| 4 | **Heartset / affective state** | felt security, shame vs. self-compassion, hope/expectancy, current mood-charge | polyvagal felt-safety; shame-resilience; ACT psychological flexibility | mood check-in `checkins.mood` (`loneliness_prescription.py:27`); loneliness trigger |
| 5 | **Stage of change** | precontemplation → contemplation → preparation → action → maintenance → (relapse) | Prochaska & DiClemente TTM; decisional balance; stage-specific self-efficacy | *(new)* — nothing in Kindred models *why* someone paused |
| 6 | **Readiness** | confidence × willingness × importance, right now | Motivational-interviewing readiness ruler; TTM self-efficacy | `readiness{confidence, willingness, desire_to_overcome_loneliness}` (`server.py:915`) — kept, now cross-checked against behavior |
| 7 | **Fears / blocks** | the specific thing under the thing; loss-aversion, exposure fear, unworthiness | approach-avoidance temperament; shame triggers; ACT experiential avoidance | onboarding motivation/"the lie" free-text (identity journey) |
| 8 | **Values / purpose** | what they're actually moving *toward* | Self-Determination Theory (OIT continuum: intrinsic/identified vs. introjected/external); ACT values | onboarding `core_values` / `growth_goals` / `interests` (`core.py:394–401`); sweet-spot/ikigai |
| 9 | **Self-efficacy** | domain-specific "I can do this next step" | Bandura self-efficacy; distinct from #6 readiness | implied in `readiness.confidence` — now separated out and behaviorally cross-checked |
| 10 | **Attachment / relational posture** | anchored / tender / guarded / whirling, *as a current state* | attachment theory (pastorally renamed, already in Kindred); polyvagal | `relational_posture` + `posture_history` (stored, capped 24, **never analyzed for trajectory** — `relational_posture.py:324–335`; we analyze it) |

### 1a. Two cross-cutting derived signals (computed, never asked)

- **Growth vs. Fear vs. Failure orientation** — a *composite* of #1 × #2 × #3, rendered as the person's dominant stance toward challenge. "Growth" = incremental belief + approach + optimistic style. "Fear" = avoidance-dominant (protecting against loss), regardless of ability. "Failure/helpless" = pessimistic-stable-global attribution + low self-efficacy (the Seligman frozen state — *not* laziness; a person protecting against a verdict). This is the direct, defensible instrument behind the owner's intuitive "growth mindset / fear mindset / frozen in fear."
- **Head–Heart gap** — the signed distance between what a person *states* (self-report dimensions 1, 6, 9 and journaled beliefs) and what their *behavior* shows (covenant follow-through, scenario choices, check-in patterns). This is the "know-it-but-don't-believe-it-yet" detector; full treatment in §4.

### 1b. Design rules that keep the model honest

- **Domain-scoped, not global.** Every estimate carries a domain tag from a per-app taxonomy (Kindred: `trust`, `initiative`, `vulnerability`; Rebuilding Dads: `presence`, `patience`, `showing-up`, `co-parent-communication`; ChurchConnect: `prayer`, `service`, `witness`). The dashboard never shows one number for "the person." *(Taxonomies are owner decision D-a, §9.)*
- **Uncertainty is first-class.** Every dimension renders with a band ("we're fairly sure" / "still getting to know you here"). Low-confidence dimensions are *never* used to gate matches or to name a pattern to the user (§7 consent).
- **Trajectory over level.** The headline output is always a *delta narrative* ("three weeks ago your posture read guarded; the last two weeks it's reading tender-anchoring") derived from history Kindred already keeps but never mines (`posture_history`, `alignment_history` — verified stored, never diffed). A flat score is a bug.
- **The Discipleship-Dynamics tiering key.** Following the Discipleship Dynamics split (only 1 of 5 dimensions is explicitly devotional; the other 4 are wholeness/relationships/calling/mission), the *substrate questions are asked in human-universal language* a not-yet-believer answers honestly. Faith is a rendering posture on the interpretation, never a gate on the assessment.

---

## 2. How we assess deeply without a quiz-wall

Validity does not come from item *quantity*. It comes from (a) high-information items, (b) formats people can't fake or fatigue on, and (c) **triangulating multiple methods** rather than piling up more of one. The 200-item survey fails all three. Five methods, layered so most of the signal accrues passively over time.

### 2a. Method 1 — Situational-Judgment items (depth that resists faking)

Instead of "Are you dependable? (1–5)," present a 3–5-sentence relational scenario and have the person **rate each response option** for how likely they are to do it. SJTs are less fakeable, lower in social-desirability bias, lower in cognitive load, and higher in engagement, because the "right" answer isn't transparent — you judge a situation, not rate yourself. (Validated Dependability SJT, PMC6392235: ω .78–.83; r .46–.57 with self-report; predicted counterproductive behavior r = −.31.)

**Design recipe (replicable):** harvest critical incidents → 5 rated options each → **expert keying, not consensus** (consensus scoring performed substantially worse and was abandoned in the validated build) → score by z-standardizing the person's ratings and measuring distance to the expert profile. LLM automatic item generation (arXiv 2412.12144) lets us grow a bank cheaply — but **every generated item still needs expert keying + empirical calibration before it goes live** (see §2g for the concrete provisioning path that keeps this from being hand-waved). Critical caveat we design around: much SJT variance is "implicit trait policy" (knowing what good looks like), so an SJT is **one triangulation input**, interpreted as *"enacts/knows what good looks like here,"* never the sole score.

> **Example SJT (Kindred, dimension #2 approach/avoidance + #10 posture):**
> *"You've been messaging someone in your pod for two weeks and it's been good. They suggest meeting for coffee this Saturday. You notice your chest tighten."*
> Rate each 1–5 (Very unlikely → Very likely):
> a. Say yes now, before you overthink it.
> b. Say you'll check your schedule and get back to them (and quietly hope it fades).
> c. Suggest a video call first instead.
> d. Tell them honestly that in-person makes you nervous and you'd still like to try.
> e. Go quiet for a day.
> *(d high + a moderate = approach with self-awareness; b + e high = avoidance/protective; the **expert key** encodes this, not the user's self-label.)*

> **Example SJT (Rebuilding Dads, dimension #5 stage + #7 fears):**
> *"Your kid's game is Saturday at 10. Your ex texts the address Friday night. You haven't been to one in months and you're worried about running into her new partner."*
> a. Confirm you'll be there and set a phone reminder now.
> b. Reply "I'll try to make it."
> c. Ask a friend to come with you.
> d. Don't reply; decide Saturday morning.
> *(pattern separates preparation-stage + support-seeking from contemplation-stage avoidance rooted in exposure fear — surfaced to the user only as a supportive reflection, never a judgment.)*

### 2b. Method 2 — Adaptive item selection (ask fewer, smarter)

Replace the fixed wall with an **IRT-calibrated item bank** and computerized-adaptive selection: after each answer, estimate the person's provisional position and pick the single most *informative* next item; **stop on a standard-error threshold, not a fixed count.** CAT averages ~50% shorter at equal-or-better precision (demonstrated on narcissism, schizotypy, and general-distress banks). A confident, internally consistent person answers ~8 items on a dimension; an ambiguous pattern earns a few more. Length scales to *that person's* ambiguity, not to a fixed 200. For forced-choice/ipsative blocks (§2e), use multidimensional pairwise CAT (bifactor MCAT is current best practice).

**Honest precondition:** CAT is only valid on a *calibrated* bank. On an uncalibrated bank, "adaptive" item selection is theater. The build path (§8) therefore ships a **fixed short form first** and switches to CAT only per-dimension once that dimension's bank clears the calibration bar in §2g. Until then the doc does not claim adaptivity we can't deliver.

### 2c. Method 3 — Longitudinal experience-sampling (assess over time, not one-shot)

The deepest lever, and the one most native to a growth product: **don't measure the person once; sample them briefly in real life.** ESM/EMA = short real-time reports across days/weeks in natural context. This is where Kindred is weakest (everything is a one-sitting snapshot) and where we add the most. Concretely: a single micro-prompt on some check-ins ("Right now, does reaching out feel more like *moving toward* someone or *avoiding* something? [toward / avoid / not sure]") feeds dimensions 2, 4, 6 with *repeated in-situ* data. The check-in Kindred already has (`checkins`) becomes the carrier. Trajectory is then real, not a re-run of the LLM over unchanged static fields.

### 2d. Method 4 — Passive behavioral triangulation (the anti-quiz)

The strongest signal isn't asked at all. We instrument what the person *does* and treat it as a dimension input:

- **Covenant follow-through** — Kindred's coaching loop records four honest paths `did_it | retry | defer | decline` and names the pattern when a user declines **3 covenants in the same theme** (`coaching.py:8–19`; `_decline_streak`, `coaching.py:99–112`). → self-efficacy #9 and stage #5.
- **Latency & initiative** — do they start conversations or only respond? Reply to a match within a day or let it sit? → approach/avoidance #2, posture #10.
- **Check-in cadence & mood-charge over time** — a run of internal-stable-global journaling language is the CAVE signal, scored by the LLM *against a rubric*, not vibes. → heartset #4, explanatory style #3.
- **Journaling as unobtrusive assessment** — free-text is scored against **construct rubrics** (ACT psychological-flexibility markers, attribution style) rather than read for sentiment. This turns the journal Kindred already has into a passive, un-gameable instrument. **Constraint:** rubric scoring runs *after* the risk layer (§8), never instead of it — a journal is a place people disclose distress, and construct scoring is blind to risk by design.

The engine's rule: **when self-report and behavior disagree, behavior wins for the estimate, and the disagreement itself becomes the head–heart signal (§4).**

### 2e. Method 5 — Anti-gaming construction

- **Forced-choice / ipsative blocks** for the most fakeable dimensions (values, motivation): make the person choose between two *equally desirable* options, defeating "agree with everything good."
- **Expert-keyed SJTs** (no transparent right answer).
- **Behavioral override** (§2d) — you cannot fake a covenant you don't keep.
- **Cross-method consistency check** — the same construct is measured by ≥ 2 methods; large method-disagreement lowers *confidence* (not the score) and, if persistent, surfaces gently as a head–heart gap rather than being trusted.
- **No stakes on the assessment.** Nothing is scored pass/fail, so there is no incentive to game (this also serves §7 humaneness).

### 2f. What we deliberately do NOT do (the pop-quiz autopsy)

- **No type output.** MBTI's core flaw is dichotomizing continuous traits — ~50% of people retest to a different 4-letter type. We output continuous positions + bands.
- **No single "primary" category.** The Five Love Languages' two central claims both fail empirically: people endorse all five, and matched partners are *no* happier (Impett et al. 2024). We model profiles across dimensions and never promise a matching effect the data can't support.
- **No claim beyond the evidence.** Where a construct is contested (mindset interventions, d ≈ .08 overall), copy and mechanics reflect that: strategy + help-seeking + visible progress + supportive climate, never effort-cheerleading.

### 2g. The item-bank provisioning path (the depth bottleneck, designed not deferred)

The entire depth claim is downstream of one asset: a **calibrated item bank**. Without it, LLM-generated scenarios scored by an LLM against LLM-written rubrics *is* the vibe-coded quiz wearing a lab coat. This section makes the cost concrete and stages it so the product is honest at every stage rather than pretending to depth it hasn't earned.

**Volume reality.** A minimum viable bank is roughly **12–20 items per dimension × per app taxonomy**, keyed per posture where the scenario language differs. Across 10 dimensions and (initially) 2 app taxonomies that is on the order of **250–400 items** to author, key, and calibrate — not a weekend. IRT calibration needs **N in the low hundreds of respondents per bank** before item parameters are stable enough for CAT.

**Who keys.** "Expert keying" names a real, resourced role, not a wish. The keying panel is **2–3 people per domain family** with relevant standing: for the relational/psychological dimensions, a licensed counselor or a psychometrician (this is also the natural owner of the crisis-boundary review, §8); for the faith-rendering layer, the owner or an owner-designated pastoral reviewer. This is owner decision **D-e** (§9): approve the keying-panel budget, or the bank ships uncalibrated and the product is capped at the "seed read" tier below.

**Three honest tiers, gated on calibration — the interim behavior CAT-on-uncalibrated-banks lacks:**

1. **Seed read (ships day one, no calibration required).** Uses only Kindred's existing self-report + behavioral signals + rubric-scored journals. Outputs are explicitly framed as *provisional* and low-confidence; the confidence rule (§7.3) does the honest work of not over-claiming. No SJT scoring, no CAT. This tier is shippable the moment durable persistence lands and is never dishonest, because it never claims more than a seed.
2. **Fixed short-form SJT (per dimension, after expert keying, before full calibration).** Each dimension flips on as its ~12–20 keyed items exist, served as a **fixed short form** (not adaptive). Confidence for that dimension rises from "seed" to "moderate." An uncalibrated bank is served as a fixed form precisely because CAT is invalid without item parameters.
3. **CAT (per dimension, after N reaches the calibration bar).** Only once a dimension's bank has enough responses to estimate stable IRT parameters does that dimension switch to adaptive selection with SE-threshold stopping. Dimensions cross this line independently; the engine runs a **mix** of tiers across dimensions at any given time, and the confidence/freshness map (§5.5) records which tier each dimension is on.

This is the answer to "the depth is asserted at the WHAT level and deferred at the HOW level": the HOW is *staged*, each stage is independently shippable, and no stage claims depth it hasn't earned.

---

## 3. The adaptive-engagement engine (challenge × reward → flow, not addiction)

Kindred's growth model is activity-volume + streak: a good scaffold but blind to *why* someone paused and prone to guilt. We replace the volume model with a **flow controller** that paces challenge to the person's current state and stage, and paces reward to intrinsic motivation.

### 3a. Target: flow, explicitly not addiction

Flow = challenge slightly above current skill, with clear goals and immediate feedback (Csikszentmihalyi). The engine sizes the *next step* so difficulty tracks self-efficacy #9 and stage #5. Kindred already scales step size by readiness — the coaching prompt is shaped by a `_readiness_hint` that maps low/moderate/high readiness to baby-step / modest-stretch / real-challenge suggestions (`coaching.py:115–130`). We generalize that hand-tuned heuristic into a closed loop:

```
next_challenge_difficulty = f(self_efficacy #9, stage #5, orientation #2, recent_follow_through)
  clamp so that P(success) ≈ 0.6–0.75    (flow zone: hard enough to matter, likely enough to win)
  if orientation #2 is avoidance-dominant OR heartset #4 shows low felt-safety:
      lower threat first (reframe as approach, shrink the step) before adding challenge
```

### 3b. Reward paced to intrinsic motivation (SDT/OIT), not dopamine loops

Rewards support the three SDT needs — **autonomy, competence, relatedness** — and move the person along the OIT continuum from external/introjected toward identified/intrinsic:

- **Competence:** reflect *progress and strategy* ("you tried the harder ask and it worked" / "you tried and it didn't — here's what that tells us"), never raw effort praise (the false-growth-mindset trap).
- **Autonomy:** the person always picks the next step from options; the engine proposes, never assigns. Rewards are informational, not controlling (controlling rewards *undermine* intrinsic motivation — the core SDT finding).
- **Relatedness:** the highest-value reward is *a person to do the next step near* (a pod member, a match, a mentor). This is also the research-backed moderator (§0): the community layer is what makes the inner work take.

Anti-addiction guardrails baked in: **no variable-ratio slot-machine schedules, no streak-anxiety pressure, no infinite feed, no dark patterns.** Streaks exist (Kindred has them) but are reframed and *pause-protected* (§3c). The metric of success is **movement on the dimensions and durable relationships**, never time-in-app or session count. Stated as a hard product invariant (owner decision D-d, §9), not a preference.

### 3c. Honoring wavering, retreat, and triggers (the non-linear journey)

TTM says relapse and cycling are *normal parts of change*, not failure. The engine treats retreat as data, not defection:

- **Detect retreat** from behavioral signals (dropped cadence, a run of `defer`/`decline`, mood-charge turning, a `lonely` check-in) → **do not** escalate challenge or fire guilt.
- **Drop into a lower gear automatically:** shrink the next step to a near-certain win, switch reward emphasis to relatedness/felt-safety, and — if heartset #4 shows a trigger — offer the compassion/loneliness prescription Kindred already has (2×-lonely-in-a-week → Soul Letter + one nearby service activity; `loneliness_prescription.py`), not a task.
- **Model *why* they paused.** Kindred's pause/resume only shields the streak; here, a pause writes a lightweight reason inference (stage regression? trigger? life event? boredom = challenge too low?) that changes what comes next. Boredom (too easy) and anxiety (too hard) get opposite responses — the flow controller's whole point.
- **Stage-appropriate moves:** precontemplation → gently raise awareness, no action asks; contemplation → decisional-balance reflection; preparation → tiny concrete plan; action → support + obstacle-planning; maintenance → relapse-prevention + identity consolidation. Handing a precontemplation person an action task is the single most common way growth apps fail; the engine refuses to do it.

> **Boundary with §8:** retreat handling above is for *ordinary* wavering. A retreat signal that co-occurs with a risk flag is **not** routed here — it goes to the Safety Gate first. Low mood is not a crisis; the two paths are kept distinct so neither is mistaken for the other.

### 3d. Concrete mechanics

- **The next step is always ONE thing,** sized to the flow zone, framed as approach ("grow toward"), chosen by the user from 2–3 options. (Extends Kindred's single-covenant loop.)
- **Reflection reward on completion:** a short, specific, strategy-linked reflection + optional testimony capture (testimony is both an *input signal* of movement and a reward generator — the ecosystem's hub-not-finish-line move).
- **Trajectory surfacing weekly:** a "here's how you've moved" delta narrative from the dimension history — the thing Kindred stores and never shows.
- **Adaptive cadence:** the engine sets its own nudge frequency from the person's state (retreat → quieter; momentum → available but never pushy).

---

## 4. The "know-it-but-don't-believe-it-yet" engine (head–heart gap)

This is the product's deepest differentiator and it maps cleanly onto the **dual-process** distinction (fast/associative "gut" belief vs. slow/propositional "stated" belief) and the formation traditions' insistence that the target is the *heart*, not behavior-compliance or intellectual assent. A person can *state* "I'm worthy of connection" (head) while their behavior and gut-level felt-safety say otherwise (heart). Kindred cannot see this at all.

### 4a. Detection

Compute **Head–Heart gap** per domain as the signed distance between:

- **Head** = stated belief (self-report #1/#6/#9, journaled propositions, identity statement).
- **Heart** = enacted/felt belief (behavioral triangulation §2d, SJT choices, in-situ ESM affect #4, latency/avoidance).

A large positive gap ("says growth, acts fear") is the signature of *known-but-not-yet-believed*. This is trustworthy only with enough triangulated evidence, so it inherits the confidence rule — we never name a gap we're not sure of.

### 4b. Working the gap over time

The engine does **not** argue the person into belief (information transfer doesn't move the heart — the formation literature is explicit). Instead:

- **Corrective *experiences*, not corrective *arguments*.** Design a small, high-success-probability behavioral experiment that lets the person *experience* the truer belief once (the flow-zone step, §3a). Belief follows enacted evidence.
- **Name it gently and only with consent,** as a noticing, never a diagnosis: *"You've written that you believe you're worth people's time — and I've noticed you're quicker to cancel than to show up. No judgment. Want to try one small thing that might let you feel the first thing is true?"*
- **Track the gap closing as the real growth metric** — a narrowing head–heart distance over weeks is the truest signal the app can report, far better than activity volume.
- **Faith rendering:** for faith-forward posture this is identity-before-performance ("your worth is already settled — let's let your body catch up to what's already true"); for faith-present it's felt-security language. Same substrate, different surface.

---

## 5. Outputs

Every run of the engine produces a small, humane bundle — never a report card:

1. **Who they are (a living read, not a type).** A short narrative of current positions on the dimensions that are *confident enough to name*, always as a *trajectory* ("you're moving from guarded toward tender"), always domain-scoped, always with an uncertainty voice. Extends Kindred's soul-read/archetype, now fed by behavior + time, not a one-shot pass over static fields.
2. **Next growth step.** ONE thing, sized to the flow zone (§3a), stage-appropriate (§3c), framed as approach, chosen by the user from 2–3 options. If precontemplation: an awareness nudge, not a task.
3. **Fitting encouragement / reward.** Strategy-and-progress-linked (not effort-cheerleading), SDT-shaped (autonomy/competence/relatedness), posture-rendered. Sized to state: retreat → compassion; momentum → competence reflection.
4. **Who to connect with.** The relatedness reward and the ecosystem's whole point. Match on *complementary current state and shared trajectory*, not just set-overlap of static values. Kindred's `compatibility_score` is verified set-overlap of `core_values`/`growth_goals`/`interests`, clamped `min(99, max(35, score))` (`core.py:392–403`); we keep it as one input but add posture-fit, stage-fit, and "grows-toward" complementarity. Per-app: Kindred = friendship/pod; Aligned Souls = dating (doctrine gate honored, geo module the only true addition); Rebuilding Dads = a brother + a mentor; Community Connections = a belonging group; ChurchConnect = a discipleship pair/pod. **Group (pod) before pair** stays the default.
5. **(Internal) confidence + freshness + tier map** — for the app/admin, not the user: which dimensions are well-triangulated, which are stale, which assessment tier each dimension is on (§2g), and what to sample next.

Every output ends in *a next practice + a person to do it near* — never a lesson.

---

## 6. Architecture — shared core vs. per-app config

### 6a. Shape: one Discernment Core, one Safety Gate, five thin configs

```
Discernment Core (new shared service; the reusable engine)
├── Dimension Registry        — the 10 constructs + rubrics + item bank (tiered per §2g)
├── Assessment Orchestrator   — fixed-form/CAT selection, SJT serving, ESM scheduling, method routing
├── Signal Ingest             — behavior/journal/check-in → dimension inputs (triangulation)
├── Estimator                 — per-domain position + uncertainty + trajectory (the delta engine)
├── Head–Heart Analyzer       — gap detection per §4
├── Engagement Controller     — flow pacing + SDT reward + retreat/stage logic (§3)
└── Output Composer           — the §5 bundle, pre-render (posture-agnostic)
        │
   ┌────┴─────────────────────────────────────────────────┐
   │ Safety Gate (§8) — runs BEFORE ingest on every        │
   │ free-text & check-in; can short-circuit the whole     │
   │ pipeline to the care path. Recall-biased. Not a       │
   │ dimension; a precondition.                             │
   └────┬─────────────────────────────────────────────────┘
        │
        └── Rendering / Posture Layer (per app)  ← the ONLY place doctrine/tone lives
```

- **Config per app (data, not code):** domain taxonomy; SJT scenario set (same constructs, app-appropriate stories); posture dial (faith-forward / faith-present / practical) with dual-vocabulary labels; match target (pod/date/brother/group/discipleship-pair); **eligibility policy (minimum age + minor-surface rules, §8b)**; which modules consume the outputs.
- **The substrate is universal; only the surface changes** — dual-vocabulary dimensions mean the assessment questions are asked in human-universal language and the *interpretation/next-step language* is what the posture dial swaps. That is what lets one instrument serve a not-yet-believer and a mature believer.

### 6b. Cross-app configuration table

| App | Posture dial (default — owner D-b) | Domain taxonomy (draft — owner D-a) | Match target | Min age / minor surface (D-f) | Doctrine gate | Notable per-app addition |
|-----|-----------------------------------|-------------------------------------|--------------|-------------------------------|---------------|--------------------------|
| **Kindred Connections** (friendship) | faith-present | trust, initiative, vulnerability | pod → pair | 18+, no minor surface | none | — (canonical baseline) |
| **Aligned Souls** (dating) | faith-forward | trust, vulnerability, intention, pace | date | 18+, no minor surface | **required, ships behind it** | geo module (the only true code addition) |
| **Rebuilding Dads / Kids-Need-Dads** (fatherhood) | faith-present | presence, patience, showing-up, co-parent-communication | brother + mentor | dad is 18+; **children are subjects, never users** — no child profiling, no child data ingested (§8b) | none | co-parent-safe framing; child never assessed |
| **Community Connections / Live-on-Mission** (belonging) | practical → faith-present | belonging, service, initiative | belonging group | 18+ default; if any youth surface exists, minor rules apply (owner must confirm) | none | open-ended audience → eligibility must be pinned, not assumed |
| **ChurchConnect** (discipleship) | faith-forward | prayer, service, witness, wholeness | discipleship pair/pod | 18+ for the discernment surface; youth ministry is out of scope for v1 | owner-set doctrine | 5-dimension Discipleship-Dynamics mapping |

*Every "min age" cell is a **decision surfaced for the owner (D-f)**, not a fact asserted by the engine. The default is 18+ with no minor surface; any app that wants a younger audience must turn minor handling on explicitly (§8b).*

### 6c. Mapping onto the existing code + module catalog

| Catalog block (`module-catalog.ts`) | What it is today (verified unless marked) | What the Discernment Core adds |
|--------------------------------------|-------------------------------------------|--------------------------------|
| `connection-engine` (assess + match) | soul_match, relational_posture, loneliness_prescription, pods; set-overlap `compatibility_score` clamped 35–99 (`core.py:392–403`) | Estimator + Head–Heart + posture/stage/trajectory-aware matching; `posture_history` finally *analyzed* |
| `becoming-growth-dashboard` | alignment (activity count) + `alignment_history` + streak + ritual + sweet-spot (`becoming.py`) | Engagement Controller replaces the volume model with flow pacing; trajectory surfacing; retreat modeling |
| `purpose-onboarding` | 8-step self-report wizard, one-shot soul-read `[pointer-only — frontend not opened]` | becomes *seed capture* only (Tier 1, §2g); short-form SJT + CAT + ESM take over for depth over time |
| `mentorship-coaching` / covenant loop | propose → `did_it/retry/defer/decline`; 3-decline-same-theme pattern (`coaching.py:8–19, 99–112`); readiness-shaped prompts (`coaching.py:115–130`) | consumes the Engagement Controller's flow-sized, stage-appropriate steps; feeds self-efficacy/stage back |
| `testimony-engine` | capture/surface stories `[pointer-only — sourced from ChurchConnect + Spark per catalog]` | wired as both movement-signal input and reward output |
| `care-counseling` | ChurchConnect care/counselor/encouragement-loop `[pointer-only — separate repo]` | **the Safety Gate's escalation target (§8)** — the care path the engine hands crisis signals to |
| `analytics-hope-index` | reporting/hope index `[pointer-only]` | reads the confidence/trajectory/tier map for a cross-app belonging index |

**Reuse-never-rebuild is honored:** the Core is a *new home* for the assess-and-grow logic today scattered across `soul_match.py`, `relational_posture.py`, `becoming.py`, `coaching.py`. One home per block. The five apps consume it; none re-implements it. New per-app work is limited to config + SJT scenario authoring + the geo module for Aligned Souls.

### 6d. Data-model deltas (extends, non-breaking)

- Keep every existing Kindred field. Add: `dimension_estimates[]` (construct, domain, position, band, confidence, freshness, method_sources, **tier**), `estimate_history[]` (the trajectory spine — unify and *analyze* the existing `posture_history` / `alignment_history`), `head_heart_gaps[]`, `stage` (TTM), `sjt_bank` + `sjt_responses`, `esm_prompts` + `esm_responses`, `engagement_state` (current gear, cadence, retreat flag + inferred reason), and — new in v2 — `safety_flags[]` (risk-layer events, §8) and `eligibility` (verified min-age / minor status, §8b).
- Everything durable rides the Neon/Supabase persistence path already in flight (the memory notes flag durable persistence as the key unlock; trajectory is impossible without it).
- **Verification gate:** the three `[pointer-only]` blocks above (`purpose-onboarding` frontend, `testimony-engine`, `care-counseling`) must be opened and their fields confirmed before any delta touches them. Do not migrate against a pointer string.

---

## 7. How it stays humane, consent-respecting, and not manipulative

Non-negotiable invariants, enforced by the Consent & Safety Gate that wraps every user-facing path:

1. **Flow, never addiction — as a hard invariant.** No variable-ratio reward schedules, no streak-anxiety, no infinite feed, no dark patterns. Success metric = movement on dimensions + durable relationships, explicitly **not** time-in-app or session count.
2. **The person can always see, question, and correct their own read.** Every named dimension is contestable ("this doesn't feel like me" → lowers confidence, re-samples). No hidden dossier. A person's model belongs to them.
3. **Never name a low-confidence read, ever.** Uncertainty gates disclosure. We would rather say less than mislabel someone.
4. **Behavioral triangulation is disclosed, not covert.** The person is told, in plain language, that the app learns from what they do, not just what they say — and can turn passive signals off. No surveillance framing.
5. **The head–heart gap is named as a gentle noticing with consent, never a diagnosis or a lever.** It is used to *offer* a corrective experience, never to pressure, shame, or upsell.
6. **No manipulation toward a predetermined answer.** The engine proposes options; the person chooses. Rewards are informational (SDT autonomy-supportive), never controlling. Faith is *offered* under the "acceptance before understanding" principle — a not-yet-believer is fully served in human-universal language and never gated, pressured, or love-bombed toward profession.
7. **Retreat is honored, not punished.** Wavering, pausing, and relapse drop the gear and increase compassion; they never trigger guilt, loss, or escalation (§3c).
8. **Safety escalation, not gamification, on distress.** Crisis signals never route to a challenge, a streak, or a growth step — they route to the care path. Full mechanism in §8; this invariant is only real because §8 gives it one.
9. **Eligibility is explicit.** No surface serves minors unless the owner turns minor handling on for that app, and when off, minors are not deep-profiled (§8b).
10. **Doctrine is separable and owner-owned.** The science layer is honest and works without faith claims; the posture layer carries doctrine and is only ever changed by the owner (consume philosophy, never invent it). Aligned Souls ships only behind its doctrine gate.

---

## 8. Safety and crisis path (mechanism, not a slogan)

This section exists because the previous draft treated crisis as a one-line invariant. A product that ingests deep psychological data, per-domain shame, "the lie," and low felt-safety from shame-bound fathers and lonely daters is operating in exactly the population where a missed ideation cue in a journal matters most. Kindred today has a dating-meetup **safety net** (`safety.py` — trusted contact + "I'm safe"/SOS, no GPS) and a **loneliness** prescription, but a repository-wide search confirms **no** self-harm / suicidal-ideation detection, no risk classifier, and no clinical boundary anywhere. That gap is closed here.

### 8a. The risk-detection layer (runs first, recall over precision)

- **Placement.** A dedicated risk classifier runs on **every free-text and check-in *before* rubric/construct scoring (§2d) and before any engine logic.** Construct scoring is deliberately blind to risk, so risk detection cannot be left to it.
- **Bias.** Explicitly tuned for **recall over precision** — a false positive costs a gentle, dignified check-in; a false negative can cost a life. We accept over-triggering.
- **What it looks for.** Acute-risk language classes: suicidal ideation, self-harm, intent/plan/means, abuse or danger to the user, and (for Rebuilding Dads especially) risk to a child. This is a *risk* signal set, distinct from the `lonely` mood tag, which is low mood, not crisis. The two are never conflated.
- **Hard short-circuit.** On a flag, the engine **does not** process the input into a dimension estimate, a growth step, a match, or a reward. The Discernment Core is bypassed and the input is handed to the care path. A flagged input never becomes a "grow toward" task.
- **Human in the loop.** A flag raises a `safety_flags[]` event routed to the **`care-counseling`** block's human/care channel — not resolved by the LLM alone. The escalation route, on-call boundary, and response-time expectation are owner-set operational policy (D-g).

### 8b. Eligibility, minors, and data minimization

- **Default eligibility is 18+ with no minor surface** across all five apps (§6b). This is a stated *decision*, not an omission.
- Kindred stores `age` only as an optional match-filter int (`server.py:80`), with no DOB, no age gate, no parental-consent handling, and no COPPA path. The engine adds none of that machinery until an app explicitly requests a younger audience.
- **Rebuilding Dads / Kids-Need-Dads:** the *dad* is the user; **children are subjects of the dad's growth, never users of the app.** No child is profiled, no child free-text is ingested, no child dimension is estimated. This is a hard rule, not a default.
- If any app (e.g., a future youth surface in Community Connections or ChurchConnect) wants to serve minors, that turns on a distinct minor-handling mode — parental consent, data minimization, no passive behavioral surveillance of minors, no deep psychometric profiling of minors — as a separate, owner-gated build. Owner decision **D-f** pins the per-app answer.

### 8c. Boundary and disclaimer

- **The engine is not a crisis service and not counseling, and says so.** Plain-language disclaimer copy appears at onboarding and adjacent to any journaling/deep-assessment surface: this app supports growth and connection, it is not therapy or emergency help, and it names where to get real help.
- **Crisis resources are shown on every flag** (region-appropriate hotline / emergency guidance), independent of whether the human care channel has responded yet.
- The licensed reviewer on the keying panel (§2g) also owns the **clinical-boundary review** of this section's copy and thresholds before launch.

---

## 9. Honest limits and open decisions (for owner review)

**Limits (what this design does not pretend):**

- **Mindset interventions are weakly evidenced on their own** (Sisk 2018 d ≈ .08; Li & Bates found belief-shift with no downstream effect). We do not sell "growth mindset" as a magic switch; the active ingredients we build are *strategy + help-seeking + visible progress + a supportive community climate* — and the community layer is the moderator, so the ecosystem's belonging design *is* the intervention.
- **SJTs partly measure knowledge, not disposition** — used as one triangulation input, never alone (§2a).
- **The item bank is the depth bottleneck and it costs real, ongoing expert time** — no stage of §2g claims depth it hasn't calibrated; the seed tier is honest precisely because it under-claims.
- **CAT is only valid on calibrated banks** — we ship fixed short forms first and switch per-dimension (§2b, §2g).
- **Trajectory requires durable persistence** — gated on the Neon/Supabase unlock already in flight.
- **Three catalog mappings remain `[pointer-only]`** — `purpose-onboarding` frontend, `testimony-engine`, and `care-counseling` were not opened in this pass; their field-level claims are unverified and must be confirmed before any data-model delta touches them (§6d). All *Kindred backend* mappings in §1/§5/§6 are verified against source with `file:line` citations.

**Owner decisions needed:**

- **D-a** — the per-app domain taxonomies (draft in §6b).
- **D-b** — the posture dial's default per app (draft in §6b).
- **D-c** — whether Aligned Souls' doctrine gate is open enough to build against.
- **D-d** — sign-off that "success = relationships + movement, not engagement time" is a binding product invariant.
- **D-e** — approve the **expert-keying-panel budget** (2–3 keyers per domain family, incl. a licensed reviewer); without it, the product is capped at the Tier-1 seed read (§2g).
- **D-f** — the per-app **minimum age and minor-surface policy** (default 18+ / no minors, §8b); any younger audience is a separate gated build.
- **D-g** — the **crisis escalation operational policy**: the human/care channel, its boundary, and response-time expectation behind the `care-counseling` handoff (§8a).

---

### Primary sources anchored in this design

Dweck (implicit theories; "false growth mindset," 2015–17); Sisk et al. 2018 meta-analysis; Li & Bates 2019; Yeager et al. 2019 (*Nature*, National Study of Learning Mindsets); Gray RST / Carver & White BIS-BAS; Elliot & McGregor 2001 (2×2 achievement goals); Abramson–Seligman reformulated learned-helplessness (ASQ/CAVE); Prochaska & DiClemente TTM; Bandura self-efficacy; Deci & Ryan SDT/OIT; Csikszentmihalyi flow; ACT psychological flexibility; dual-process theories; SJT validation (PMC6392235); SJT automatic item generation (arXiv 2412.12144); IRT/CAT literature (PMC7344143, PMC7868333, PMC4875708); ESM/EMA methodology; MBTI / Five-Love-Languages critique (Truity; Impett et al. 2024); Willard formation; LifeWay *Transformational Discipleship* (8 signposts); Discipleship Dynamics (5 dimensions).

*Verified Kindred code citations (repo: `~/Documents/Kindred Connections/backend/`):* `core.py:392–403` (compatibility_score, set-overlap, clamp 35–99); `coaching.py:8–19, 99–112, 115–130` (four covenant paths, 3-decline-same-theme pattern, readiness-shaped prompts); `server.py:80, 915` (age as match-filter int; readiness 3-slider shape); `relational_posture.py:324–335` (posture_history stored, capped 24, not diffed); `becoming.py:157` (alignment_history stored, not diffed); `loneliness_prescription.py:27` (2×-lonely → letter + service); `safety.py` (dating-meetup safety net, not psychological crisis handling).
