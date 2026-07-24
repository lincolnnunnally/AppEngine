# Experience-Sampling Prompts & Journaling Construct Rubrics

— hardened per panel review P1/P2 (2026-07-04)

**Status:** Source-of-truth design extension. Companion to `discernment-engine.md` (v2) and `logotherapy-meaning-spine.md`. For owner review before build.
**Author's posture:** Written to be read by a Frankl scholar and a seasoned pastoral counselor without either wincing. Faith-present by default (the noetic dimension is real in the not-yet-believer — Frankl's own stance); a faith-forward render is offered, never coerced.
**What this is:** Two working instruments the base engine calls for by name but did not yet specify. (1) The **ESM micro-prompt set** — the actual in-the-moment prompts that ride on check-ins and feed the eleven dimensions over real time (base §2c, `esm_prompts`/`esm_responses`). (2) The **journaling construct rubrics** — how free-text is *scored against constructs, not sentiment* (base §2d "journaling as unobtrusive assessment"), so an LLM or the owner can read a journal as an instrument.
**Two hard inheritances from the base docs, stated once here and assumed everywhere below:**
1. **The Safety Gate runs first — and the vacuum↔crisis boundary is asymmetric and gate-first, never a bypass.** Every free-text and check-in passes the risk classifier (base §8a, recall-biased, errs toward the check-in) *before* any ESM tag or rubric score is computed. **The gate is blind to the meaning/mood/vacuum distinction and evaluates EVERY input, including every vacuum-flagged one; only inputs it CLEARS are eligible for meaning-work routing.** Construct scoring is deliberately blind to risk; it never substitutes for risk detection. A journal is where people disclose distress — rubric scoring is downstream of the gate, never instead of it. Critically: **"vacuum-risk routes to meaning-work, not to the Safety Gate" describes what happens *after* the gate has already cleared the input — it is NOT "vacuum language skips the gate," and must never be built as one.** "What's the point" is a meaning marker AND a possible risk marker; the risk classifier, not the meaning rubric, adjudicates, and it errs toward the check-in (low PIL is a replicated correlate of suicidal ideation). Vacuum-risk and low mood are *not* crisis *as constructs* and are kept distinct from it (base §8a; spine §6 sub-signal 6) — but no vacuum flag ever skips the gate, and a genuine crisis flag always wins.
2. **States, not traits.** Every prompt and every rubric samples a *moment in context*, re-estimated over time. Nothing here labels a person. The output of both instruments is evidence for a position-plus-band on a dimension, weighted by confidence and stamped with freshness — never a type, never a verdict (base §0, §1).

---

## PART 1 — THE EXPERIENCE-SAMPLING (ESM) MICRO-PROMPT SET

### 1.1 Design rules (what makes these humane, not clinical)

- **One tap or one line. Never more.** ESM's whole power is low burden sampled often (base §2c). A prompt that takes effort gets skipped or faked. Most prompts are a 2–4 option single tap; a few invite one optional line.
- **In-the-moment, not retrospective-survey.** The stem asks about *right now* or *today*, in natural context — the thing a one-sitting onboarding wall structurally cannot do.
- **Human-universal language, posture-rendered at the surface.** The substrate question is asked in words a not-yet-believer answers honestly; the posture dial (base §7) only ever changes the *surface* wording, never the construct. Where the wording meaningfully shifts, both renders are given below.
- **Never every check-in.** ESM is *sampled* — the Assessment Orchestrator serves at most one micro-prompt on a fraction of check-ins, weighted toward the dimension with the stalest/least-confident estimate that this context can inform (base §5.5 confidence/freshness map). Over-prompting is a dark pattern and it poisons the data.
- **No stakes, always skippable.** "Prefer not to say / skip" is a first-class option on every prompt (never scored as avoidance by itself — base §2e "no stakes on the assessment"). A skipped prompt lowers freshness; it never lowers a score.
- **Behavior still wins.** These are self-report *in situ* — richer than a survey but still a claim. When an ESM tap disagrees with behavior, behavior wins for the estimate and the disagreement becomes head–heart signal (base §2d, §4).

### 1.2 Response-format legend

- **`[tap-N]`** — single tap, N labeled options (+ always a silent "skip").
- **`[slider-2pole]`** — a two-anchor slider (rendered as 3–5 discrete stops, not a raw 0–100, to avoid false precision).
- **`[tap + optional line]`** — one tap, then an optional one-line free-text that is *itself* passed through the Safety Gate and can feed the journaling rubrics (Part 2).
- **`[emoji-set]`** — a small fixed affect palette (humane, fast), mapped to construct values behind the scenes, never shown as a "score."

### 1.3 The prompt bank (~18 prompts)

Each prompt is tagged with the **dimension(s)** it feeds (numbers per `discernment-engine.md` §1 plus **#11** per the meaning-spine), the **sub-signal** where relevant, and the **response format**. Prompts are grouped by what they sample. IDs (`ESM-xx`) are stable handles for the item bank and the Orchestrator.

---

#### A. Orientation — approach ↔ avoidance (Dimension #2)

**ESM-01 · the move, right now**
> "Right now, does reaching out feel more like *moving toward* someone — or *getting away from* something?"
`[tap-3]` Toward · Away · Not sure — **→ #2** (this is the base doc's own canonical ESM stem, §2c; kept verbatim as the anchor item)

**ESM-02 · the tighten**
> "You've got something social on the calendar soon. When you picture it, what does your body do?"
`[tap-3]` Leans in a little · Tightens up · Nothing much — **→ #2 approach/avoidance, #4 felt-safety** (a somatic read, polyvagal-flavored, no jargon)

**ESM-03 · the first move**
> "Today, did you start a conversation with someone — or wait to be started with?"
`[tap-3]` I started one · I waited · Neither happened — **→ #2 initiative, cross-checked against actual latency data (base §2d)**

---

#### B. Heartset / felt-safety / affective state (Dimension #4)

**ESM-04 · felt-safety, plain**
> "Right now, how safe does the world feel — not *is* it safe, but how does it *feel*?"
`[slider-2pole]` On guard ↔ At ease — **→ #4 felt-safety** (polyvagal felt-safety in human words; this is the floor other meaning-work waits on — spine §III-D)

**ESM-05 · the charge**
> "How's your heart today?"
`[emoji-set]` (a small palette spanning heavy / flat / tender / steady / bright) — **→ #4 mood-charge**, feeds trajectory; deliberately *not* a 1–10 depression item

**ESM-06 · toward yourself**
> "When you think about how today went, are you being hard on yourself or kind?"
`[tap-3]` Hard on myself · Somewhere in between · Kind to myself — **→ #4 shame ↔ self-compassion** (shame-resilience axis)

---

#### C. Readiness & self-efficacy (Dimensions #6, #9)

**ESM-07 · the readiness ruler, in situ**
> "That next small step you've been sitting with — right now, how ready does it feel?"
`[slider-2pole]` Not yet ↔ I could do it today — **→ #6 readiness** (MI readiness ruler, sampled live instead of once)

**ESM-08 · can-I, this one**
> "The thing you're facing this week — do you believe you can do *this specific* next bit?"
`[tap-3]` I think I can · I'm not sure · Not this one — **→ #9 self-efficacy, domain-specific** (kept distinct from #6 per base §1)

---

#### D. Meaning — presence (Dimension #11, sub-signal 1)

**ESM-09 · did today hold meaning** *(the owner's named prompt)*
> "Did today hold any meaning for you?"
`[tap + optional line]` A lot · A little · Not really — *"anything you'd name?"* (optional) — **→ #11 presence-of-meaning** (PIL/MLQ-Presence theme, in one plain question; the optional line feeds the journaling rubric)

**ESM-10 · pointing somewhere**
> "Right now, does your life feel like it's pointing somewhere?"
`[tap-3]` Yes, I can feel it · Sort of · Not really — **→ #11 presence** (spine §II ESM stem, kept)

**ESM-11 · worth the morning**
> "This morning, was there something that made getting up worth it?"
`[tap-3]` Yes · I had to push through · Honestly, no — **→ #11 presence** (PIL's "mornings worth waking for" theme; a soft Sunday-neurosis / vacuum probe — spine §6)

---

#### E. Meaning — search (Dimension #11, sub-signal 2) — *modeled on its OWN axis vs. presence*

**ESM-12 · looking or resting**
> "Lately — are you looking for something more, or resting in what you already have?"
`[tap-3]` Still looking · Resting in it · Both at once — **→ #11 search-for-meaning** (SONG/MLQ-Search; "both at once" is the healthy high-presence/high-search striver — spine §II sub-signal 2. Read *jointly* with ESM-09/10/11: search alone is neither good nor bad; its valence depends on presence.)

**ESM-13 · the reach**
> "Is there a question about your life you keep circling back to right now?"
`[tap-2]` Yes, there is · Not really — **→ #11 search** (a live-search probe; "yes" + low presence = the vacuum *in motion*, the highest-yield reachable state — spine §II)

---

#### F. Self-transcendence vs. self-preoccupation (Dimension #11, sub-signal 5) — *the owner's named prompt*

**ESM-14 · inward or outward** *(the owner's named prompt)*
> "Today, were you more turned *inward* — or *toward* someone or something beyond you?"
`[tap-3]` Turned inward · Turned outward · A bit of both — **→ #11 self-transcendence** (Frankl's core anthropology, spine §4; a self-preoccupied run here is the dereflection trigger — spine §III-D)

**ESM-15 · for someone**
> "Did you do anything today *for* someone else — even something small?"
`[tap + optional line]` Yes · No · Didn't think about it — *"who / what?"* (optional) — **→ #11 self-transcendence, behaviorally anchored** ("a person to serve" is the top of the reward hierarchy — spine §4; the optional line is a testimony/reward seed)

---

#### G. Attitudinal stance toward suffering (Dimension #11, sub-signal 4) — *the owner's named prompt*

**ESM-16 · when today was hard** *(the owner's named prompt)*
> "When today was hard, did it feel like it *meant* something — or did it just hurt?"
`[tap-3]` It meant something · It just hurt · Nothing hard today — **→ #11 attitudinal stance** (tragic-optimism read — spine §5. "Just hurt" is NOT scored as failure; it's the *invitation* for the sequenced, safety-gated attitudinal reframe — spine §III-D. Never offered while felt-safety is low.)
> **⚠ Gate reminder at the item (P3-4):** this is one of the two highest-risk free-text surfaces in the ESM set — a suffering prompt where a distress disclosure can arrive on the optional line. The optional line passes the **Safety Gate first**, before any attitudinal-stance tag; the gate is blind to the meaning/mood distinction and a genuine crisis flag always wins. Meaning routing happens only on inputs the gate clears.

**ESM-17 · the stance**
> "Right now, the hard thing you're carrying — do you feel like you have any say in how you meet it?"
`[tap-3]` Yes, some say · A little · None right now — **→ #11 attitudinal stance / freedom-to-take-a-stand** (Frankl's "last of the human freedoms"; "none right now" + active suffering routes toward the attitudinal move *after* safety, or flags for gentle support — never a lecture)

---

#### H. Orientation-of-the-day / catch-all (light, feeds several)

**ESM-18 · one word for today**
> "One word for how today felt."
`[tap + optional line]` (choose from a small rotating set — e.g., *heavy · full · empty · steady · scattered · alive*) + optional line — **→ #4 mood-charge, #11 vacuum-risk** (*empty*/*scattered* recurring is a Sunday-neurosis/vacuum pattern — spine §6; scored only across repetition, never a single tap; the optional line feeds the rubric)
> **⚠ Gate reminder at the item (P3-4):** the *empty*/*heavy* taps plus the optional line make this the other highest-risk free-text surface in the set. The optional line passes the **Safety Gate first**, before any vacuum-risk tag; a `⚑ vacuum` reading is *not* a gate bypass — the gate clears the input before any meaning routing, and a genuine crisis flag always wins.

---

### 1.4 How the ESM stream is read (three rules that keep it honest)

1. **Presence × Search are two axes, never one slider.** ESM-09/10/11 (presence) and ESM-12/13 (search) are read as a **quadrant**, never summed. Low-presence + high-search ("still looking" + "no" to pointing-somewhere) is the *vacuum in motion* — reachable and urgent — and must not be misread as the deadened vacuum (low/low). This is the load-bearing psychometric fact from the meaning-spine (§II sub-signal 2); the ESM design exists to keep these separable in the data.
2. **Repetition, not any single tap, is the signal.** One "it just hurt" is a Tuesday. A two-week run of *empty* / *turned inward* / *no meaning* is a trajectory the engine may (confidently) name and act on. Single taps only nudge freshness and a provisional position; patterns move confidence (base §1b trajectory-over-level).
3. **Disagreement is data.** ESM self-report vs. behavior (initiative latency, covenant follow-through, who-they-serve) that disagrees lowers confidence and, if persistent, surfaces gently as a **head–heart gap** (base §4) — never trusted as truth over what the person actually did.

---

## PART 2 — THE JOURNALING CONSTRUCT RUBRICS

**What these are:** the scoring logic that turns the free-text journal Kindred already has (base §2d) into a *passive, un-gameable instrument*. The reader — an LLM at first, the owner or a keyer during calibration — reads a journal entry **against constructs, not sentiment.** Sentiment says "this entry is sad." These rubrics say "this entry shows internal-stable-global attribution (explanatory style, pessimistic pole), high self-preoccupation (Frankl), and a stated-vs-enacted gap on worthiness (head–heart)." That is an instrument reading, and it is what the engine needs.

**How to use a rubric (for the LLM or the human reader):**
- For each construct, decide which **level/pole** the entry best evidences, cite the **exact phrase(s)** that justify it (a rubric score with no quoted marker is inadmissible — it is vibes wearing a lab coat, base §2g), and assign a **confidence** (how much of the entry actually bears on this construct — a two-line entry rarely supports a confident read).
- **Score only what the text supports.** Most entries touch two or three constructs, not all. "Insufficient evidence" is the correct and common output for a given construct on a given entry; it is not a failure.
- **Absence is not a low score.** Not mentioning others in a grocery-list entry is not "self-preoccupation." Score a pole only when the text *evidences* it, never when it merely *omits* the opposite.
- **Aggregate across entries, never over-read one.** A construct position is a trajectory over many entries with confidence bands (base §1b), not a verdict from a single hard night.
- **Four inheritances, always on:** (i) the entry cleared the **Safety Gate** first (base §8a) — rubric scoring is blind to risk and never a substitute for it; (ii) **behavior wins** over stated text when they conflict (base §2d); (iii) never surface a **low-confidence** read to the user (base §7.3); (iv) meaning is **elicited, never prescribed** — a rubric *reads* a person's meaning, it never tells them what their life means (spine §III-D guardrail i).

The four rubrics below are the four the owner named: **Franklian meaning markers**, **explanatory style**, **ACT psychological-flexibility markers**, and **head–heart-gap signals.**

---

### RUBRIC A — Franklian meaning markers (feeds Dimension #11)

Scores the five readable facets of the meaning dimension against Frankl's constructs (spine Part I). Each facet is scored independently; they do **not** sum to a "meaning score."

#### A.1 Presence of meaning *(→ #11 sub-signal 1; PIL/MLQ-Presence)*

| Pole | What it looks like | Example language markers |
|---|---|---|
| **Present** | Life reads as directed, coherent, worth it; a felt "point" | "it mattered that I was there" · "I know why I'm doing this" · "hard, but it was worth it" · "this is what I'm for" · "even the boring parts felt like they added up" |
| **Ambiguous / thin** | Going through motions; meaning asserted but flat | "I guess it was fine" · "did the things, checked the boxes" · "supposed to feel meaningful" · "on paper it's good" |
| **Absent / vacuum-adjacent** | Emptiness, pointlessness, flatness (NB: distinct from sadness — see the disambiguation note) | "what's the point" · "none of it matters" · "just filling time" · "empty" · "going through the motions" · "why bother" |

> **Disambiguation (critical, spine §3 anti-psychologism):** *empty / pointless* ≠ *sad*. A person can be tearful and full of meaning (grief that means everything), or dry-eyed and empty (the vacuum). Score presence off **meaning language** (point, direction, worth, mattering), not affect language (sad, tired, down). Collapsing the two is the exact category error the meaning-spine forbids. Low presence routes to meaning-work; it is *not* a crisis flag (which the Safety Gate owns independently).

#### A.2 Search for meaning *(→ #11 sub-signal 2; SONG/MLQ-Search) — score jointly with A.1*

| Pole | What it looks like | Example language markers |
|---|---|---|
| **Actively searching** | Questing, reaching, unsettled-in-motion | "trying to figure out what I'm meant for" · "there has to be more than this" · "keep asking myself" · "looking for something I can't name" |
| **At rest** | Settled, not reaching (can be healthy contentment OR deadened) | "I'm good where I am" · "not really asking those questions" · "content" · "don't think about it much" |

> **Read A.1 × A.2 as a quadrant, never a sum** (spine §II sub-signal 2): *searching + low presence* = **vacuum in motion** (reachable, urgent — the highest-yield state); *searching + high presence* = **healthy striving** (feed it); *at rest + high presence* = **settled** (protect it); *at rest + low presence* = **deadened vacuum / Sunday neurosis** (reawaken the search gently — you cannot hand meaning to someone not yet reaching). The rubric's job is to place the entry in the quadrant, with markers cited for each axis.

#### A.3 Dominant value-pathway *(→ #11 sub-signal 3; the meaning triangle, spine §2)*

Score which pathway the entry evidences as *live* — and, where visible, which is *atrophied or blocked*. An entry can show more than one.

| Pathway | Meaning found through… | Example language markers |
|---|---|---|
| **Creative** (what one *gives*) | Work, making, building, serving, contributing, showing up | "I built / made / finished" · "showed up for" · "they needed me and I came through" · "put in the work" |
| **Experiential** (what one *receives*) | Encounter, love, beauty, being-known, a moment | "the light on the water" · "just being with her" · "felt truly seen" · "that song wrecked me in a good way" · "held my kid and time stopped" |
| **Attitudinal** (the *stance* toward unavoidable suffering) | Meaning wrested from what can't be changed | "can't fix it, but I can face it with…" · "this is teaching me" · "if I have to carry this, I'll carry it well" · "it's not what I'd choose, but it's mine to meet" |

> **Prescriptive read:** an entry heavy on **creative** ("I achieve, I provide") with **experiential** entirely absent across many entries ("can't receive love / can't just *be* with anyone") is the over-achieving/can't-receive profile the spine flags (§II sub-signal 3) — the intervention opens the *closed* door (experiential), not the already-open one. Note the *blocked* pathway, not only the live one.

#### A.4 Self-transcendence vs. self-preoccupation *(→ #11 sub-signal 5; spine §4)*

| Pole | What it looks like | Example language markers |
|---|---|---|
| **Self-transcendent** | Attention on tasks, causes, persons beyond self; naming others | "I wonder how she's doing" · "wanted to help him" · "it's not about me, it's about the kids" · lots of other-people subjects |
| **Self-preoccupied / hyper-reflective** | Attention locked on self-monitoring, rumination, "how am I doing / how do I seem" | "I keep replaying how I came across" · "what do they think of me" · "obsessing over whether I…" · entry is almost entirely *I / me / my* with no other agent |

> **Marker-count is a hint, not the score.** Count the ratio of other-people-as-agents to self-as-sole-subject, but weight it by *content*: an entry about caring for a sick parent that says "I" a lot is still self-transcendent. High self-preoccupation across entries is the **dereflection trigger** (spine §III-D) and predicts stalled matching (a self-absorbed posture can't yet receive another).

#### A.5 Attitudinal stance toward suffering *(→ #11 sub-signal 4; tragic optimism, spine §5)*

Score only when the entry actually describes suffering/hardship. Read against the tragic triad's three turns.

| Stance | What it looks like | Example language markers |
|---|---|---|
| **Meaning-taking** (the redemptive turn) | pain→achievement, guilt→change, transitoriness→action | "this is making me into someone" · "the guilt is showing me what to fix" · "life's short — so I'm going to…" · "worth it despite" |
| **Enduring, not yet turning** | Bearing it, no meaning found *yet* (a legitimate, non-failure state) | "just getting through" · "one day at a time" · "surviving" |
| **Collapse / numb / rage** | Overwhelmed, shut down, or turned to anger — meaning foreclosed for now | "what's the use" · "I'm done" · "nothing I do matters" · "just furious at all of it" |

> **Never score "enduring" or "collapse" as a deficit to be corrected on the spot.** They mark *where safety and gear-lowering come first* (base §3c). The attitudinal-reframe intervention (spine §III-D) is offered **only after felt-safety is restored** and **only for genuinely unavoidable** suffering — never valorize avoidable suffering (change that situation instead), and never bypass a flooded nervous system with a meaning question (spiritual bypass — spine §III-D guardrails ii, iii).

---

### RUBRIC B — Explanatory style (feeds Dimension #3; ASQ/CAVE-derived)

Scores how the writer *explains the causes* of what happens to them, along the three reformulated-learned-helplessness attribution dimensions (Abramson–Seligman; base §1 dim #3). This is the CAVE method (Content Analysis of Verbatim Explanations) — extract every causal statement, score its three dimensions, aggregate. **Score causal explanations, not mood.** A cheerful entry can carry pessimistic attributions; a sad entry can carry optimistic ones.

**Procedure:** find each **causal statement** (an event + the writer's explanation of *why* it happened), then score that explanation on three axes. The pessimistic/depressogenic pattern is **internal + stable + global for bad events** (and the reverse for good events).

| Axis | Optimistic pole (for *bad* events) | Pessimistic / depressogenic pole (for *bad* events) | Example markers |
|---|---|---|---|
| **Internal ↔ External** | External: "the situation / timing / they" | **Internal:** "it's me, my fault, something about who I am" | pess: "I'm just bad at this" · "there's something wrong with me" / opt: "the meeting was set up to fail" · "she was having a rough day" |
| **Stable ↔ Unstable** | Unstable: "this time / today / a one-off" | **Stable:** "always, never, forever" | pess: "it's always like this" · "I never get this right" · "this is just how it'll always be" / opt: "today was rough" · "that was a one-time thing" |
| **Global ↔ Specific** | Specific: "this one area / just this" | **Global:** "everything, my whole life, all of it" | pess: "my whole life is a mess" · "I ruin everything" · "nothing works out for me" / opt: "this one project flopped" · "just the money stuff right now" |

> **The frozen-in-fear signature (base §1a):** internal + stable + global explanations for bad events, especially paired with low self-efficacy (#9), is the Seligman learned-helplessness pattern — **NOT laziness, a person protecting against a verdict.** The intervention is corrective *experience* (a flow-zone win, base §3a), never argument. Also score the **reverse for good events**: a person who explains good things as external/unstable/specific ("just luck / this once / doesn't count") is discounting evidence — the same helplessness engine running the other direction, and a specific head–heart target (Rubric D).
> **Do not confuse with Frankl's attitudinal stance (Rubric A.5).** Explanatory style is *why did this happen* (causal attribution); attitudinal stance is *what will I do with the fact that it happened* (meaning-taking). A person can have a pessimistic explanatory style AND a meaning-taking attitudinal stance — that combination is precisely tragic optimism (sees the tragic clearly, still says yes).

---

### RUBRIC C — ACT psychological-flexibility markers (feeds Dimension #4, cross-checks #2, #7)

Scores the entry on the ACT hexaflex poles — **psychological flexibility** (contact with the present, acceptance, defusion, values-action, self-as-context) vs. **inflexibility** (fusion, avoidance, past/future-fixation, values-disconnection). Base doc names ACT psychological flexibility under heartset #4 and journaling in §2d. Score the poles the entry evidences; not every entry touches all six.

| Process | Flexible pole (markers) | Inflexible pole (markers) |
|---|---|---|
| **Acceptance ↔ Experiential avoidance** | "let myself feel it" · "sat with the discomfort" · "didn't run from it" | "anything to not feel it" · "numbed out" · "kept busy so I wouldn't have to think" · "pushed it down" |
| **Defusion ↔ Cognitive fusion** | "I noticed the thought that I'm a failure" · "my mind was telling me…" (thought held *as* a thought) | "I *am* a failure" · "it's just true that I'm worthless" (thought fused *as* reality) |
| **Present-moment ↔ Past/future fixation** | "right here, this is what's in front of me" · "I noticed where I was" | "couldn't stop replaying" · "spun out about everything that could go wrong" · lives entirely in rumination/worry |
| **Values-action ↔ Values-disconnection** | "did the thing that matters even though it was hard" · "acted like the person I want to be" | "know what matters but did the opposite" · "avoided the thing I care about again" |
| **Self-as-context ↔ Fused self-story** | "part of me felt X, and I'm bigger than that part" · flexible self-view | "this is just who I am, permanently" · rigid, totalizing self-definition |
| **Committed action** (composite) | takes a values-linked step despite discomfort | discomfort dictates behavior; avoidance wins repeatedly |

> **The load-bearing ACT read for this engine:** **experiential avoidance** + **cognitive fusion** together are the raw material of the base doc's #7 fears/blocks and #2 avoidance-orientation. And the **values-action gap** ("know what matters, did the opposite") is a *direct* head–heart signal (Rubric D) — the person states the value and enacts its opposite. Defusion markers are the hopeful ones: a person who can say "my mind was telling me I'm a failure" (rather than "I am a failure") already has the crack of light the engine builds on — and it dovetails with Frankl's self-distancing (spine §7, the mechanism behind paradoxical intention).

---

### RUBRIC D — Head–heart-gap signals (feeds the Head–Heart Analyzer, base §4)

Scores the **signed distance between stated belief (head) and enacted/felt belief (heart)** *within and across* entries — the product's deepest differentiator (base §4). This rubric does not read one pole; it reads the **gap between a stated proposition and the evidence around it.**

> **⚠ The "gap" is a COMPOSITE, not a single seam (P2-6).** "Head vs. heart" fuses **three** distinct things that can each diverge from one another, not only from the "head":
> 1. **implicit vs. explicit *cognition*** (dual-process — what you propositionally assert vs. what your associative system actually predicts),
> 2. **stated vs. *behavioral enactment*** (the values–action gap — an ACT/behavioral construct, *not* dual-process),
> 3. **felt *affect*** (polyvagal — what your body reports as safe/worthy in the moment).
> Because these are three axes, the binary "head vs. heart" is theoretically muddy and, more importantly, **misses a real and hopeful case: someone who BEHAVES worthy while still FEELING unworthy (enactment ahead of affect).** The naive binary would read matching behavior as "aligned (gap ≈ 0)" and miss that the *felt* pole hasn't caught up — which is precisely a person on the *good* trajectory (living into the truer thing before they feel it), the opposite of hypocrisy. Score the three axes distinctly where the text supports it, and never call "behavior matches stated belief" *aligned* without checking the affect pole.

**Procedure:**
1. Extract every **stated belief / value / intention** (head): a proposition the writer asserts about themselves or what they'll do — "I believe I'm worth people's time," "I'm going to reach out this week," "I'm a present father now."
2. Extract the **enacted/felt evidence** (heart) available in the same entry *and* from behavior (covenant follow-through, latency, ESM affect, SJT choices — base §2d/§4): what they actually did, what their body/affect reported, whether the intention became an action.
3. Score the **gap and its sign.**

| Gap reading | What it looks like | Example language markers (the tell) |
|---|---|---|
| **Aligned (gap ≈ 0)** | stated belief, enacted behavior, *and* felt affect all agree | "I said I'd show up and I did" · states worth, behavior shows it, *and* it felt true |
| **Enactment ahead of affect** (the hopeful gap the binary misses — P2-6) | stated belief + behavior agree, but felt affect lags — behaves worthy while *feeling* unworthy | "I showed up even though the whole time I felt like I didn't belong" · "did the brave thing; still felt like a fraud doing it" — **do NOT score as aligned**; this is a person living into the truer thing before they feel it (the good trajectory), and the corrective *experience* is exactly what lets affect catch up to enactment |
| **Positive gap: says-growth-acts-fear** (the signature) | states the healthier belief; behavior/affect contradicts it | "I know I'm worthy of connection" *followed by* "so I cancelled again" · "I'm totally over it" *while* the whole entry circles the thing · "I'm fine" doing all the work in an entry that clearly isn't |
| **Within-entry self-contradiction** | head and heart collide in the same breath | "I've forgiven him — I just can't stop thinking about what he did" · "I don't care what they think, but I rewrote the text nine times" |
| **Discounting-the-good (reverse gap)** | evidence is positive; stated self-belief refuses it | did the brave thing, then "but that doesn't really count" · "anyone could have done it" (pairs with Rubric B's optimistic-events-discounted pattern) |

> **The head–heart tells, named (base §4a):**
> - **"but / anyway / I guess"** hinges that reverse a stated positive ("I know I matter, *but*…") — the clearest textual signature of a positive gap.
> - **stated intention + non-enactment** across the entry or against behavior data ("I'll reach out this week" that never becomes a covenant kept).
> - **protest-too-much** intensity ("totally fine," "completely over it," "don't care at all") whose surrounding text belies it.
> - **value stated + opposite enacted** (the ACT values-action gap, Rubric C) — the cleanest cross-rubric confirmation.
>
> **Handling rules (base §4b, §7.5 — non-negotiable):** a head–heart gap is scored *only with enough triangulated evidence* (inherits the confidence rule) and is **named to the user only gently, with consent, as a noticing — never a diagnosis, never a lever.** The engine's response is a **corrective *experience*** (a small, high-success flow-zone step that lets the person *feel* the truer belief once — belief follows enacted evidence), **never a corrective argument.** The narrowing of the gap over weeks is the truest growth metric the app reports (base §4b). For faith-forward posture this renders as identity-before-performance ("your worth is already settled — let's let your body catch up"); faith-present renders as felt-security language. Same substrate, different surface (base §4b).

---

### 2.5 How the four rubrics compose (one entry, read as an instrument)

A single journal entry is passed (post-Safety-Gate) to all four rubrics; each returns **{construct → pole/level, quoted markers, confidence}** or *insufficient evidence*. The Estimator folds these into the dimension positions with method-source tagging (base §6d `method_sources`), where they **triangulate** with SJT, ESM, and behavior. The cross-rubric confirmations are the high-value events:

- **Rubric B (internal-stable-global for bad) + low #9 self-efficacy** → the frozen-in-fear composite (base §1a) → corrective experience, not argument.
- **Rubric C (values-action gap) + Rubric D (stated value / opposite enacted)** → a confirmed head–heart gap on that value → gentle noticing + corrective experience (base §4).
- **Rubric A.1 low presence + A.2 at-rest + Rubric C experiential-avoidance** → the deadened vacuum with avoidance sealing it → reawaken search gently, do *not* raise task difficulty (spine §III-B.3: boredom here is a meaning problem, not a flow problem).
- **Rubric A.4 self-preoccupation (sustained)** → dereflection offer (spine §III-D.1).
- **Rubric B pessimistic style + Rubric A.5 meaning-taking** → tragic optimism, the healthiest hard-season profile — reflect it back as strength, don't "fix" it.

**And the standing floors, every time:** the entry cleared the Safety Gate first; behavior outranks stated text on conflict; nothing low-confidence is surfaced; no read is ever a verdict — only evidence for a moving, uncertainty-banded, domain-scoped position the person can see, question, and correct (base §7.2). The rubrics *read* a person as an instrument; they never *tell a person who they are*.

---

### Sources anchored in these instruments

**ESM/EMA** methodology (brief, repeated, in-context self-report — base §2c). **Meaning instruments** adapted (not pasted) per spine §9: PIL (Crumbaugh & Maholick 1964) → presence; SONG (Crumbaugh 1977) → search; LAP-R (Reker 1992) → existential-vacuum + choice/responsibility; MLQ (Steger et al. 2006) → the presence×search two-axis logic. **Frankl** constructs (spine Part I): meaning triangle (creative/experiential/attitudinal values); self-transcendence vs. self-preoccupation; tragic optimism and the tragic triad; existential vacuum / Sunday neurosis; dereflection; self-distancing. **Explanatory style:** Abramson–Seligman reformulated learned-helplessness; ASQ/CAVE content-analysis method (internal/stable/global). **ACT:** the hexaflex psychological-flexibility processes (acceptance/defusion/present-moment/values/self-as-context/committed action). **Head–heart gap:** a *composite* seam (P2-6), not a single one — implicit-vs-explicit *cognition* (dual-process), stated-vs-*enacted* behavior (ACT values–action gap), and *felt affect* (polyvagal), which can diverge from one another (incl. the enactment-ahead-of-affect case) — per base §4. All handling inherits `discernment-engine.md` §4, §7, §8 (Safety Gate first; behavior-wins; confidence-gated disclosure; consent; states-not-traits) and `logotherapy-meaning-spine.md` (meaning elicited-never-prescribed; two-axis presence×search; safety-before-meaning sequencing).
