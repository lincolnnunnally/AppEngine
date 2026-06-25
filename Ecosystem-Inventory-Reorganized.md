# Life Produces Life — Ecosystem Inventory (Reorganized)

*A cleanup of the ChatGPT-compiled inventory. Nothing was deleted — items were
reclassified into the right bucket (App / Module / Agent / Pathway / Dream) so the
list can seed your App Engine profile without 40 things pretending to be 40 apps.*

---

## 1. The test I used to sort everything

One rule decided which bucket each item went into:

| Bucket | One-line test | Where it lives |
|---|---|---|
| **App** | A user opens it as its own product | Its own front end, shared Supabase |
| **Module** | A reusable Lego block several apps share | Shared Supabase schema, called by many apps |
| **Agent** | A worker *inside* App Engine | App Engine, not a public app |
| **Pathway** | A guided journey *inside* an app | A flow within an app, not its own app |
| **Dream** | Not built, not next | Parking lot |

The reason this matters: you're building on **one shared Supabase**. So the question
is almost never "should this be an app?" — it's "is this a *new front door*, or a
*block the existing apps already share*?" Most of the list turned out to be blocks.

---

## 2. The canonical apps

### Tier 1 — The Mission (not an app)
**United Under God / Life Produces Life.** This is the *why*, per the master doc.
It is not software. Everything below is an instrument under it.

### Tier 2 — The six core journey apps
These are the confirmed six from the source-of-truth doc. They map to the
transformation cycle: **Testimony → Hope → Service → Belonging → Identity → Growth**.

| App | The person says… | Cycle position | Role |
|---|---|---|---|
| **Spark of Hope** | "I feel alone / hopeless." | Hope | The first spark — testimonies, encouragement, mentor connection |
| **Live On Mission** | "I want to matter." | Service | The movement — service, challenges, mission groups |
| **Best Life** | "I'm surviving, not thriving." | Growth / Identity | Transformation — habits, goals, skills, health, relationships |
| **ChurchConnect** | "Our church loses people." | Belonging | Community infrastructure — follow-up, events, groups, comms |
| **Opportunity** | "I have a problem." | The reframe | Turns problem → opportunity → action → testimony (closes the loop) |
| **App Engine** | "We need tools." | The factory | Builds all of the above. Customer is *builders*, not the public |

**Opportunity and App Engine are the two ends of one pipe.** Opportunity is the
*discovery* end — a person describes a problem and it gets clarified into a real need.
App Engine is the *build* end — it makes the tool that meets that need. They feel like
the same thing because they share the **Intake module** (Opportunity = intake for
people, App Engine = intake for builders) and sit on the same problem → solution track.
And Opportunity isn't one monolith: it's an *assembly* of shared modules — Intake +
Connection + Navigator + Testimony. That assembly is the Lego model proving itself.

### Tier 3 — The same mission, aimed at a specific audience
These are their own apps, but most are **not** outside the transformation cycle — they
run the same spine (*isolation → worth → purpose → community → growth*) for a specific
person in a specific pain. Kids Need Dads and the financial/business tools are the
mission applied to an audience. The honest exceptions are the commercial products
(Toner, Laser Engrave): they share the platform and login but don't run the
transformation arc, and that's fine — no need to over-spiritualize a toner reorder app.

| App | Status | Notes |
|---|---|---|
| **Kids Need Dads** | Active concept | Standalone, but pulls Mentorship + Connection (dads' support circles) modules |
| **Toner Management** | Active | Business product. Pulls Inventory + Billing + Scheduling modules |
| **Laser Engrave Market** | Active | Marketplace product |
| **Easy Peasy Website** | Active | Rapid website builder (shares the Website Builder module) |
| **Iconium** | Active — has repo | AI icon / logo / image generation (the tool that finally nailed the Barefoot feet) |
| **Kindred Connections** | **Built — has its own repo** | The standalone *belonging + growth* app, and the engine for the Connection module (see §4). Most mature piece — mine its matching code first. *Confirm whether "Aligned Souls" is the same thing or distinct.* |
| **Co-Parenting / ChildFirst** | Concept | See §6 — these collapse into one co-parenting product |

*Other repo-backed products identified in §10 — Snip.Show (clip tool), RacketPro and
JeepFix (Connection-engine configs), Easy Peasy (site builder) — belong here too; §10 is
the authoritative repo→product map.*

---

## 3. The big reclassification — "apps" that are actually modules or pathways

This is the heart of what you asked for. These were listed as separate apps in the
ChatGPT inventory, but each is really a block or a flow inside something else.

| Listed as | Actually is | Lives in / powers |
|---|---|---|
| **UUG Connect** | Module (Communication — the pipes) | Every app — messaging, groups, notifications |
| **Connecting people around a problem / purpose** | Module = **Kindred Connections** (belonging) | Kindred Connections (standalone), Opportunity, Kids Need Dads, ChurchConnect, most apps |
| **Opportunity Intake** | Pathway + Module (Intake) | Opportunity (and reused by ChurchConnect, App Engine) |
| **Opportunity Navigator** | Module (Recommendation) | Opportunity, Best Life |
| **Barefoot Coalition** | Sub-brand + uses Matching module | Branded face of Live On Mission's service side |
| **Milstead Community Platform** | Instance of Community modules | A local deployment, not a new app |
| **Neighbor Needs** | Module (Needs↔Helper Matching) | Live On Mission, ChurchConnect, Opportunity |
| **Acts of Service Marketplace** | Same Matching module | Same as above |
| **Community Project Hub** | Same Matching module | Same as above |
| **Local Skills Exchange** | Same Matching module (skills) | Future community layer |
| **Local Resource Sharing** | Same Matching module (resources) | Future community layer |
| **Live On Mission Kids** | Pathway (youth segment) | Live On Mission |
| **Identity Discovery** | Pathway + Module | Best Life (and Opportunity) |
| **App Catalog** | Module (the Lego store itself) | App Engine |
| **Design / Review / Deployment Agent** | Agents | App Engine (see §5) |
| **AI Coach / AI Mentor Network** | Module (Coaching + Mentorship) | Spark of Hope, Best Life, Kids Need Dads |
| **Testimony Engine** | Module (backend engine) | Powers Spark of Hope; closes Opportunity's loop |
| **Hope Index** | Module (Analytics) | Dashboard across all journey apps |
| **Service Engine** | Module (backend engine) | Powers Live On Mission |
| **Resource Recommendation Engine** | Same as Navigator/Recommendation module | Opportunity |
| **My Success** | Overlaps Best Life + Coaching | Fold into Best Life unless the audience truly differs |
| **BackOffice Works** | Module bundle (CRM + Workflow) | Business apps |
| **Business Consulting Platform** | Content/templates layer | Business apps |
| **Co-Parenting Assistant** | Pathway/module | Kids Need Dads / ChildFirst |

**The single most important finding:** five "apps" — Neighbor Needs, Acts of Service
Marketplace, Community Project Hub, Local Skills Exchange, Local Resource Sharing —
are all **one module**: *match a need with a helper*. Build it once. Every community
and service feature in the whole ecosystem is a skin on that one engine.

**The second finding — and the more important one for *people*:** "connecting people"
is not the Communication module. Communication is the pipes (messaging, notifications);
the belonging engine is **Kindred Connections** — an app you've already built and have
a repo for. Its thesis is sharp and worth stating plainly: loneliness pushes people to
*settle* for a wrong partner or burn months proving someone out by trial and error.
Kindred Connections instead **assesses and grows each person first**, then matches on
**mindset and heartset** — dreamers and encouragers paired so they build each other up
toward something bigger, holding the belief that hitting a problem isn't failure, it's
the next stage you get to solve. **Friends and growth first; romance, if it comes, comes
naturally later**, once a person has rediscovered who they are. That same engine lives
inside Opportunity (connect around the problem someone just described), Kids Need Dads
(other men who've been there), and is, in plain terms, what a church is for. Build it
once; it's the human spine of nearly every app.

---

## 4. Shared modules — the Lego blocks

These live in the shared Supabase and get reused across apps. This list *is* the
argument for the shared database: identity, testimonies, and matching all flow between
apps because they're one set of tables, not copies.

| Module | What it does | Apps that use it |
|---|---|---|
| **Identity & Auth** | One login across the ecosystem | All apps (the keystone) |
| **Communication** (the pipes) | Messaging, groups, notifications | Most apps |
| **Kindred Connections** (belonging / growth) | Assess + grow each person, then match on mindset & heartset for friendship and mutual growth — friends first, group-first | Kindred Connections (standalone), Opportunity, Kids Need Dads, ChurchConnect, most apps |
| **Events & Scheduling** | Events, RSVPs, calendars, booking | ChurchConnect, Live On Mission, coaching |
| **Needs ↔ Helper Matching** | Match a need with a helper (asymmetric) | Live On Mission, Barefoot, ChurchConnect, Opportunity, community |
| **Intake** | Guided problem → structured profile | Opportunity (people) ↔ App Engine (builders), ChurchConnect |
| **Recommendation / Navigator** | Suggest next apps, people, resources | Opportunity, Best Life |
| **Testimony Engine** | Capture, store, surface real stories | Spark of Hope, Opportunity |
| **Mentorship / Coaching** | Match mentors, AI coach, guidance | Spark of Hope, Best Life, Kids Need Dads |
| **Growth Tracking** | Habits, goals, skills, progress | Best Life, My Success |
| **CRM / Follow-up** | Track people, automate follow-up | ChurchConnect, business apps |
| **Payments / Billing** | Donations, subscriptions, invoicing | Business apps, Toner, donations |
| **Website Builder** | Generate sites fast | Easy Peasy, ChurchConnect, business |
| **Hope Index / Analytics** | Measure hope, belonging, engagement | Dashboard across journey apps |

**Kindred Connections vs. Needs↔Helper Matching — keep them separate.** Both pair
people up, but they optimize for different things:

- **Kindred Connections** optimizes for *belonging and mutual growth* — peers around a
  shared purpose, who build each other up over time. Symmetric.
- **Matching** optimizes for *getting a need met* — one helps, one is helped. Asymmetric.

**Kindred Connections' design rules (non-negotiable, or it degrades into a dating app or a lonely-people directory):**

1. Connect around **purpose**, not just availability.
2. Every connection must be **mutually beneficial** — both people grow.
3. **Groups often beat one-on-one.** Default to gathering, not pairing.
4. Anchor it in **shared mindset / heartset** — dreamers and encouragers who match.
5. **Assess and grow each person *first*** — don't match raw loneliness; match grown people.
6. **Friends and growth before romance.** Dating, if it happens, happens naturally later.
7. **Reframe problems as success-stages** — a problem means you reached the next step, not that you failed.

---

## 5. App Engine agents — the full roster (the part that was missing)

Your inventory listed **3** (Design, Review, Deploy). ChatGPT later surfaced **6**
behavior patterns. Neither is the full loop. Below is the complete roster the App
Engine loop *implies* — Problem → Intake → Design → Build → Test → Deploy → Improve —
which is where your "about twelve" instinct comes from.

**Status key:** ✅ Confirmed (in your inventory) · 🟡 Surfaced (ChatGPT behavior list) · 🔵 Proposed (loop requires it, not yet named)

| # | Agent | Loop stage | Job | Status |
|---|---|---|---|---|
| 1 | **Orchestrator** (Loop Conductor) | (runs the loop) | Enforces gates, hands work off *with its context* | 🔵 |
| 2 | **Intake Agent** | Problem → Intake | Turns a raw problem into a structured spec | 🔵 |
| 3 | **Planner Agent** | Intake → Plan | Produces the build-on-top plan, names the files it will extend | 🟡 |
| 4 | **Architect / Source-of-Truth Agent** | Gate | Checks the plan against existing architecture; **blocks drift** | 🔵 |
| 5 | **Design Agent** | Design | UI/UX so good code isn't an ugly app | ✅ |
| 6 | **Builder Agent** | Build | Writes / refactors code (the Codex lane) | 🟡 |
| 7 | **Reviewer Agent** | Review | Code quality, catches contradictions | ✅ 🟡 |
| 8 | **Tester Agent** | Test | Runs tests, reports pass/fail | 🟡 |
| 9 | **Gatekeeper Agent** | Gate | Blocks merge if gates fail (deterministic, script-backed) | 🟡 |
| 10 | **Deployment Agent** | Deploy | Ships to Vercel / Render / Hetzner | ✅ |
| 11 | **Improvement Agent** | Improve | Learns from results, proposes refactors | 🔵 |
| 12 | **Catalog / Module Librarian** | (cross-cutting) | Stores, versions, and improves reusable modules | 🔵 |

**Agent #4 is the one you've been missing in practice.** The whole drift problem —
agents inventing new architecture instead of building on what exists — is the job of
a Source-of-Truth/Architect gate that *fails the step* when a plan doesn't reference
existing files. That's the SKILL.md + preflight script work we already started; it's
not a new idea, it's just an agent that never got named in the inventory.

---

## 6. Pathways inside apps (not apps)

Your own inventory already said the health/recovery items should be pathways, not
apps — confirming that here, plus the others.

- **Health & recovery** (depression, anxiety, addiction, grief, cancer support,
  suicide prevention, loneliness) → pathways inside **Spark of Hope** and **Opportunity**.
- **Youth** (Live On Mission Kids) → segment inside **Live On Mission**.
- **Identity Discovery** → pathway inside **Best Life**.
- **Co-Parenting Assistant + ChildFirst Solutions** → these two are really *one*
  co-parenting product (parenting plans, neutral communication, documentation,
  court prep). Decide if it's its own app or a module set inside **Kids Need Dads**.

---

## 7. Dreams / future tier (real, but not next)

Parked deliberately so they stop competing for attention with active work:

- **UUG Mesh Communication Network** (decentralized comms)
- **Community Resilience Network** (local preparedness)
- Local Skills Exchange / Local Resource Sharing → these aren't dreams of their own;
  they're the **Matching module** pointed at skills and resources once it exists.

---

## 8. Decisions to make before seeding the profile

A short list — not analysis paralysis, just the forks that change the data model:

1. **My Success** — fold into Best Life, or keep separate? (It looks like a duplicate.)
2. **Co-Parenting / ChildFirst** — own app, or module set inside Kids Need Dads?
3. **Iconium / Aligned Souls** — confirm current scope so they're tagged right.
4. **The 12 agents** — which do you actually want built first? My vote: #4 (Architect),
   #9 (Gatekeeper), #1 (Orchestrator). Those three are the anti-drift core; the rest
   are lanes you already run manually across Claude and Codex.
5. **Repo strategy** — the architecturally load-bearing one. The Lego / shared-Supabase
   model needs shared modules to have **one home**, or they get copy-pasted into each app
   repo and drift — which is the exact problem you keep fighting. Recommended: one
   monorepo (`/apps/*` for the front doors, `/modules/*` for the Lego blocks, with the
   source-of-truth doc and `.claude` / `.agents` skills at the root). Mine the existing
   repos for their best code first (Kindred Connections' matching/assessment logic is the
   priority), then archive the originals read-only as reference. This is *gather-and-reuse*,
   not rebuild — it's the most on-brand thing for your "build on what exists" rule.

---

## 9. The gap — what we actually need to build

Stepping back from the buckets: the thing that doesn't exist yet is the one that
matters most. It's the **support + Kindred Connections + Testimony app**, built per
community around a specific problem — the place where a hurting, isolated person finds:

1. **Others who lived exactly this** — Kindred Connections, around shared experience.
2. **Proof it gets better** — Testimony; they made it through.
3. **A next step and people to walk it with** — Navigator + Kindred Connections as a group.

Almost everyone we serve has lost hope and couldn't find help for *their specific
situation*, so they conclude they're alone. They aren't — the support just hasn't been
built. That app is **Spark of Hope + Kindred Connections + Testimony** composed together
and pointed at one problem at a time. Everything else in this document — the agents, the
modules, App Engine itself — is infrastructure for building *that*, fast, over and over,
for every problem and every community.

---

## 10. Repo inventory — 29 repos, clustered

Pulled from the GitHub connector (owner `lincolnnunnally`). Now identified with your
input. The headline: **29 repos are about a dozen real products — and several of those
are configurations of the same two or three engines.** The rest are duplicates,
rebuilds, experiments, and backups — repo-level drift, the same problem you fight inside
the code.

**Toner platform (8 repos → 1 core + monitoring module + admin).** Same core engine;
the differences are *business-model config*, not separate apps.

| Repo | Role | Disposition |
|---|---|---|
| TotalTonerManagement | Core platform | Candidate canonical — confirm on read |
| TotalToner | Same core | Merge |
| TM-UserDash | Customer dashboard | Merge as a view |
| PrinterProtectorCustomer | Own-supply + monitoring-fee model | Merge as a billing mode |
| TonerTracker | Cost-per-page model | Merge as a billing mode |
| TM-Admin | Admin over all toner apps | Keep as admin module |
| TM-Admin-portal | Likely dup of TM-Admin | Merge |
| PrinterProtectorMonitoringTool | The reusable monitor | **Keep as the monitoring module** |

**The Connection family (7 apps → 1 engine + 6 configs).** Each is Kindred Connections'
engine pointed at a specific community and the problem/purpose they gather around.

| Repo | Community it serves | Disposition |
|---|---|---|
| Kindred-Connection | People seeking belonging (general) | **Keep — this IS the engine; read first** |
| RacketPro | Racket-sport players: partners, coaches, mental game, teams | Rebuild as a config of the engine |
| JeepFix | Jeep owners: shared problems, fixes, videos, rides, parts | Rebuild as a config (your §9 gap-app, for Jeeps) |
| RebuildingDads | Struggling dads | Merge into Kids Need Dads, on the engine |
| KND-google-ai | Struggling dads (other agent's build) | Merge into Kids Need Dads |
| childfirst-solutions | Co-parenting families | Keep beside KND; co-parenting config |

**Church family (ChurchConnect + 2 configs).**

| Repo | Role | Disposition |
|---|---|---|
| ChurchConnectNew | ChurchConnect rebuild | Likely canonical |
| ChurchConnect | Original | Merge → archive |
| Association | Association → its member churches (a tier up) | Config of ChurchConnect, not a new app |
| honestly | Cross-church benevolence coordination & stewardship | Fold in as a ChurchConnect module |

**Factory + mission (the keystone — and a live drift casualty).**

| Repo | Role | Disposition |
|---|---|---|
| AppEngine | The factory | **Keep — keystone** |
| life-produces-life-source-of-truth | The master-doc root | **Keep — the root of everything** |
| life-produces-life | Forked App-Engine/mission build | Merge into the SoT repo — duplicated work |

**Other products + tools.**

| Repo | What it is | Disposition |
|---|---|---|
| Snip.Show | Clip tool (= the ClipManager idea, shipped) | Keep — canonical name |
| emergent | Same clip app, built on the Emergent platform | Merge into Snip.Show |
| Iconium | AI icon / logo / image generation (born from the Barefoot feet problem) | Keep; also feeds the Design Agent |
| Website-friends | Easy Peasy Website (easypeazy.site) — all-in-one site builder | Rename to Easy Peasy |
| LaserEngraving | Laser Engrave Market | Keep (commercial line) |
| ideas | Idea capture → turn into article/post/app/video | Keep — it's the *front door* of App Engine + the content hub |

**Content / principle (not an app) + reference.**

| Repo | What it is | Disposition |
|---|---|---|
| Million-Mistakes | "Mistakes = growth" mindset/content brand | Not an app — it's a core *principle* (same as Kindred rule 7 & Opportunity); feeds Best Life + content hub |
| AllReposBackup | Backup of everything | Archive |

**Findings worth sitting with:**

1. **The Connection engine is the highest-leverage thing you own.** Seven products
   collapse into one engine plus six community configs. Build Kindred Connections right,
   and RacketPro, JeepFix, Kids Need Dads, Association, and ChurchConnect's people-layer
   stop being separate builds. This is the single biggest reason your work keeps getting
   redone — seven agents built the same engine seven times because none could see the
   others.

2. **Toner is eight repos that are one platform.** The "different focuses" (own-supply
   vs. customer's-provider vs. cost-per-page) are billing config on a shared core, plus
   one reusable monitoring module. Eight → roughly three pieces.

3. **The two life-produces-life repos are the drift problem, caught in the act.** You
   built something, asked to extend it, and the agent rebuilt it from scratch into a
   second repo. That's exactly what the Architect/Gatekeeper agents (§5) and the monorepo
   (§8.5) exist to prevent.

4. **Four of the six core journey apps still have no repo.** No Spark of Hope,
   Opportunity, Best Life, or Live On Mission. The energy went to App Engine, the
   Connection engine, ChurchConnect, and the commercial products. The transformation core
   — what the mission is *about* — is still unbuilt, which is the same truth as §9.

5. **`ideas` and `Million-Mistakes` aren't strays.** `ideas` is the capture-and-convert
   front end of App Engine (speak an idea → it becomes an app, article, post, or video).
   `Million-Mistakes` isn't an app at all — it's a principle already wired through the
ecosystem. Both belong, just not as standalone apps.
