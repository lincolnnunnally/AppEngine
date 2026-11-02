# HANDOFF — Owner desk: what is built, what is left

**From:** Claude Code (session 2026-09-03)
**To:** Grok (xAI), or whichever build agent picks this up
**Subject:** the private owner desk at `dashboard.unitedundergod.org`
**Built and open for review:** PR #336, branch `claude/admin-dashboard-integration-0kujyy`

---

## 0. Read this before you touch anything

1. `CURRENT_SCOPE.md` and `AGENTS.md` in this repo.
2. `BUILD-LEDGER.md` — **pull the live copy and claim your item before you build.** The check-out
   protocol at the top of that file is binding: claim, commit the claim on its own, push, *then* work.
3. `source-of-truth/app-ops-reporting-standard.md` — the contract every generated app carries, and
   the honesty rule this whole surface lives by.
4. `source-of-truth/app-portfolio-registry.md` — the registry's required fields.

**The one rule that governs every item below:** report what is true, or say plainly that you cannot
see it. Never an invented number, never a guessed URL, never a `0` standing in for "unknown". Most of
the work in PR #336 was removing places where the desk broke that rule. Do not put them back.

---

## 1. Ledger situation — read before claiming

`BUILD-LEDGER.md` line ~126 carries this item:

> 🟡 **Ops deep-dive: clickable card detail — users, revenue (sum of payments), activity trend**
> **Claimed by: Grok (xAI) · 2026-07-27 22:25 EDT · branch: feat/ops-card-detail-revenue**

Two facts about that claim, both verified 2026-09-03:

- **The branch does not exist on origin.** `git ls-remote --heads origin` returns nothing matching
  `ops-card-detail-revenue`. By the ledger's own rule ("a 🟡 claim older than ~24h with no branch/PR
  goes back to 🟢"), that claim expired about five weeks ago.
- **PR #336 substantially delivers that item.** Per-app revenue, clickable card detail, and the
  activity/growth columns are built and green. This item has now failed once before as well — PR #284
  was closed unmerged on 2026-07-05.

**So: do not rebuild it.** Read §2, then update the ledger to reflect what #336 actually shipped
before claiming anything new. If you were the agent holding that claim, this is your prior work
landing — extend it, don't restart it.

---

## 2. DO NOT REBUILD — what PR #336 already did

All of this is on `claude/admin-dashboard-integration-0kujyy`, CI green, verified against a running
server. Read the diff before starting; several items below build directly on these.

**Coverage**
- `operate` added to `source-of-truth/ecosystem-portfolio-registry.json` and
  `src/lib/engine/app-ops-catalog.ts`. It is a live shop system that was in neither file, so the desk
  was structurally blind to it. Its door is `/desk` (verified in the operate repo), not a guessed
  `/admin`. Rollups recomputed: **37 apps, 26 live**.
- `familyForSlug()` returns a new `unfiled` family instead of silently filing unknown apps under
  *Practical services*.

**Admin doors**
- `resolveAdminDoor()` now returns `{ url, note, state }` where `state` is
  `open | no_address | none`, plus `ADMIN_DOOR_REASON` copy. `DeckApp` carries `adminState`,
  `adminNote`, `adminReason`.
- The fleet table (`business-explorer.tsx`) renders **Open ↗** and **Admin ↗** per row, and explains
  the 9 absences instead of leaving a blank. A `Has an admin door (28)` chip sweeps the fleet.

**Drill-down**
- Every cell in the fleet table is a destination: people/active/new/orders → `/apps/{slug}#doing`,
  money → `/reports/money?stream=…`, help → `/inbox?app={slug}`.
- Dead tiles fixed: money strip's *available now* / *pending payout*, the *orders* tile, the whole
  by-family rollup, `/admin`'s six metrics, `/owner-control-center`'s roster names, `/domains`' app
  slugs.
- Two 404s fixed: `/reports` → `/apps/appengine-core` and `/inbox` → `/apps/other`. `canonicalSlug()`
  and `isKnownAppSlug()` are now exported for exactly this kind of link guard — **use them.**
- `?apps=` is read and applied (view key → family id → search term). It was passed in and dropped.
- Attention list: no cap, count in the heading, rows open their app, `watch` items visible in a fold.

**Money honesty**
- `streamSlugForApp()` / `isRevenueWired()` in `revenue-streams.ts`. A slug with no classifier renders
  **"not wired"**, never `$0.00`. `toner-connect` and `printer-protector-monitoring` alias into the
  `toner` stream so their real revenue resolves. An `operate` classifier exists for when billing turns on.
- AppEngine's `ticketsOpen` scoped to its own queue — it was counting the entire ecosystem inbox.
- Central and in-app help queues shown separately, not summed.

**Correctness**
- `getInboxCounts()` counts in SQL (`GROUP BY`), not over the newest 200 rows in JS.
- `stripeGet()` has an 8s timeout.
- Dossier attention joins on `slug`, not display name.

**Look** — the `.desk` EasyPeazy skin applied consistently: unscoped `.dx-note`/`.dx-domain` (they
were stranded inside a dead `.dx-app` wrapper), page rhythm from the shell grid, transitions, one
focus ring, clickable affordance, `/admin` rewritten in desk vocabulary, legacy card classes given the
desk skin. New utilities: `.dx-cell-link`, `.dx-linkish`, `.dx-doors`, `.dx-doorlink`, `.dx-inset`,
`.dx-subhead`, `.dx-fold`.

**Guards added** in `scripts/smoke-owner-business-command.js` — the deck must render a door, no
`dx-stat` tile may be a dead `div`, unattributable revenue may never be a zero. These exist because
the doors were silently deleted once before. Keep them passing.

---

## 3. What is LEFT — 32 items, prioritized

Every item was confirmed by an adversarial audit pass (each finding independently verified against the
code, over-claims corrected). File and line refer to the state of `main` as of `610bba4`; re-check
after merging #336.

### Tier 1 — still-open blockers (4)

**1.1 `/owner-control-center` renders a second, smaller roster than the desk home.**
`src/lib/engine/app-portfolio-registry.ts:198`. The desk home enumerates all 37 apps from the JSON
registry; `/owner-control-center` derives its own 23-card grid and **18 registry apps are entirely
unrepresented** there (11 of them live) — among them toner-connect, pulse, immerse, neighborly,
presence, speak-to-me, barefoot-coalition, furfriend, ai-website-design, united-under-god, milstead.
It is bidirectional: the derived roster also carries 5 entries with no JSON counterpart
(`association`, `jeepfix`, `racketpro`, plus pseudo-entries `life-core` and
`future-ecosystem-apps-services`).
*Fix:* make the JSON registry the base roster in `loadOwnerPortfolioRegistry()` — seed from
`getPortfolioUrlStatusBoard().entries`, then merge seed/imported/owner-registered entries onto it by
slug, with an alias map for `appengine↔appengine-core`, `spark-of-hope↔spark-of-hope-intake-lite`,
`ideas↔ideas-idea-capture`. The only existing `SLUG_ALIASES` is `owner-deck.ts:190` and it covers just
the first. Merge in **both** directions.
*Acceptance:* both desk routes enumerate the same set; a smoke test asserts the two counts are equal.

**1.2 Whole-desk up/down is seeded JSON that no runtime probe can contradict.**
`src/lib/engine/portfolio-url-status.ts:88`. `urlStatus` comes from the owner-maintained registry, so a
dead app still reads "Live". The live reachability probe exists but lives in a side list.
*Fix:* in `loadOwnerDeck`, when a board entry says `live` but that app's freshest `OpsAttentionItem` is
`kind: "unreachable"` / `severity: "action_needed"`, render "Live — not answering" and exclude it from
`liveCount` and the family `live/total`. (#336 already renders `factsAsOf` and `opsCheckedAt` in the
hero, so staleness is visible — that half is done.)

**1.3 No error boundary anywhere in the app, and a 29-way bare `Promise.all`.**
`src/app/(cockpit)/owner-control-center/page.tsx:88`. One failing store hands the owner a raw Next
stack page.
*Fix:* add `src/app/(cockpit)/error.tsx` (client boundary, renders the shell + "this panel could not
load" + retry). Then give every element of that `Promise.all` a `.catch(() => <empty default>)` the way
`loadOwnerDeck` already does, so one bad store costs one panel, not the page.

**1.4 `APPENGINE_STATE_ADAPTER="memory_fallback"` throws at module import.**
`src/lib/engine/durable-state-adapter.ts:220`. Three modules branch on a value the factory rejects, and
a throw at module scope is unrecoverable by any error boundary.
*Fix:* add the missing arm — `if (mode === "memory_fallback") return createMemoryStateAdapter();` — or
make the factory fail soft to `createLocalMockStateAdapter()` on an unknown mode.

### Tier 2 — the business layer (this is what the desk is *for*)

This tier is the real remaining substance. The desk can now be navigated; it still cannot tell Lincoln
how most of his businesses are doing.

**2.1 Eleven of 26 live apps have no people/activity source at all — including the ones that take money.**
`src/lib/engine/lpl-ops-stats.ts:78`. The `SOURCES` map covers the LPL-Supabase apps; the Neon-backed
Toner platform and the Render/Supabase commerce apps have nothing.
*Fix:* add read-only count sources per app (a read-replica URL or a small counts endpoint) for at least
users/customers and 30-day orders. **Until an app has one, do not render a bare "—"** — put a per-app
reason string next to its catalog entry ("Toner runs on Neon; no counts source configured") and show it
on the row. A dash must always carry its explanation.

**2.2 Seventeen live apps can never be attributed revenue; FurFriend has a Stripe key slot and no classifier.**
`src/lib/engine/revenue-streams.ts:36`. #336 added `operate` and the toner-family aliases; the rest
remain.
*Fix:* add a classifier for every slug with a Stripe key slot — **furfriend first, a key slot with no
classifier is a bug** — plus dreamstand, sandlot, immerse, pulse. Longer term, stamp
`metadata.app_slug` at checkout in each app so classification stops depending on description regexes.

**2.3 No MRR, subscriptions, or churn — for a portfolio with three subscription businesses.**
`src/lib/engine/stripe-summary.ts:33`. Only 30-day charge totals exist.
*Fix:* add a subscriptions read to `stripe-summary`/`revenue-detail`: active subs per account, MRR by
normalizing each item to a monthly figure, subs created/cancelled in 30 days. Surface MRR + active
subscribers as tiles on `/reports`, and per-app on the dossier. Classify subs through the same
`classifyCharge` logic so they attribute to the same streams.

**2.4 Two different portfolio revenue totals on one desk.**
`src/lib/engine/stripe-summary.ts:26`. The deck and `/reports` read one Stripe key; `/reports/money`
reads up to ten. The two numbers disagree and nothing says why.
*Fix:* have `loadStripeSummary` delegate to `loadRevenueDetail`'s aggregate so one number is computed
once. If the single-key read is kept for speed, label it — "$X across 1 of 4 readable Stripe accounts".

**2.5 The "one inbox" has no feeder from any app, and its zero reads as "inbox is clear".**
`src/lib/engine/ecosystem-inbox.ts:118`. No live app forwards help requests, so the empty state is
telling Lincoln something it cannot know.
*Fix:* add `inboxWired: boolean` to the ops-catalog entry, set when that app has
`APP_ENGINE_INBOX_URL` + token or a help link. Where false, the empty state must read "This app does
not forward help requests to the desk yet" with a link to the wiring step. Then land the forward —
the cheapest version is a footer link to `/help?app={slug}` in each live app, needing no backend work.

**2.6 Provenance and staleness are computed then thrown away.**
`src/lib/engine/owner-deck.ts:244`. Numbers read from the shared DB, and hour-old cached readings, are
both captioned "from the app's own count".
*Fix:* add `note: string` and `checkedAt: string | null` to `DeckApp`, pass `ops?.note ?? ""` through
`loadOwnerDeck`, and render it as the users-tile caption — falling back to the hard-coded string only
when the note is empty. On `/reports`, show the note whenever non-empty: a stale-reading warning
matters *more* on a row showing numbers than on a blank one.

**2.7 "Active (30d)" is structurally impossible for every shared-database app, and the dossier gives the wrong reason.**
`src/lib/engine/lpl-ops-stats.ts:70`. It says the trend needs two weeks of numbers; the truth is there
is no activity column to read.
*Fix:* add optional `activeUsers?: { table; lastSeen: string; schema? }` to `Source`, populate
`activeUsers30d` via `<lastSeen>=gte.<isoDaysAgo(30)>` where such a column exists, null elsewhere. In
the dossier, branch the caption on *why* it is null — no source vs. short history.

**2.8 Immerse's "open help requests" counts every stay request ever recorded.**
`src/lib/engine/lpl-ops-stats.ts:118`. No status predicate, so a fabricated backlog.
*Fix:* add the predicate matching the `immerse_stay_requests` schema (`status=eq.pending`, or
`status=in.(pending,new)`). **If that table has no status column, drop the tickets source** — a dash
beats an invented backlog. Check the schema before adding any new `SOURCES` entry.

**2.9 United Under God's "People" is its interest/waitlist table, presented as users.**
`src/lib/engine/lpl-ops-stats.ts:124`.
*Fix:* add `usersLabel?: string` (default "users") to `Source`, carry it through `AppOpsStats` into
`DeckApp`, and let this tile read "interest sign-ups". Either exclude differently-labelled counts from
`usersAcrossApps` or rename that stat to something the mix supports.

**2.10 Revenue with no costs, so no app has a profit picture.**
`src/app/(cockpit)/reports/page.tsx:276`.
*Fix:* record cost where it is already known — domain purchase price and annual renewal on each
domain-inventory entry, LLM usage records tagged with the app slug they were spent on (the build job
already knows it), and a manual monthly hosting cost per app in the ops catalog. Then add "Cost 30d"
and "Net" columns beside the revenue column #336 added.

### Tier 3 — coverage and data integrity

**3.1 Non-live apps are silently excluded from the ops layer.** `src/lib/engine/ops-stats.ts:311` —
11 of 37 desk rows can never carry ops-layer business data or attention items.
*Fix:* drop the `status !== "live"` guard; set the target's `live` flag from the status instead
(`live: entry.status === "live"`), which `collectAttentionForApp` already consumes.
*Caveat the audit verified:* this alone yields **zero** extra attention items, because every existing
check needs `subject.url` or `subject.vercelProject` and 10 of the 11 have no resolvable URL. To
actually surface milstead.us / milstead.church you must **add a status-keyed check** (probe
`https://<intendedDomain>`, or emit an item straight from the registry status). Relaxing the guard is
necessary but not sufficient — don't stop there and call it done.

**3.2 Headline people/reporting counts don't reconcile with the table.**
`src/lib/engine/owner-deck.ts:310` — summed over ops records that have no row in the rendered app list.
*Fix:* compute `usersAcrossApps` and `reportingApps` from the rendered `apps` array. Give unmatched
`job:`/`env:` ops records their own `DeckApp` rows (family `factory`, or a new "built here" family)
rather than letting them float in the totals.

**3.3 Slugs exist in code that the registry and catalog do not carry.**
`src/lib/engine/imported-ecosystem-apps.ts:155`. Verified against #336's merged state — four slugs in
`IMPORTED_ECOSYSTEM_APPS` are absent from the registry, and they are two different problems:
- **Genuinely absent apps:** `association`, `jeepfix`, `racketpro`. They carry documented merge
  rulings, have no desk row, and therefore can never have an admin door.
- **Slug drift, not a missing app:** `ideas-idea-capture` is the same product as the registry's
  `ideas`. It needs an alias, not a record — the same class of bug as `appengine-core`, which #336
  fixed with `canonicalSlug()`.

The desk never reads that file at all. Registry and catalog are currently **identical at 37 slugs**
(verified) — that invariant is worth protecting.
*Fix:* promote the three real apps into the JSON registry as `parked` records carrying their rulings
(or delete them and keep the ruling in source-of-truth prose), and add `ideas-idea-capture` to the
alias map rather than the registry. Then add a build-time test asserting **registry slugs == CATALOG
slugs == the union of all rosters, modulo the alias map** — that test is what keeps 1.1 from
regressing.

**3.4 Nothing ties a desk app to its GitHub repo.**
`source-of-truth/ecosystem-portfolio-registry.json:8` — no `repo` field exists.
*Fix:* add `repo: "lincolnnunnally/<name>"` (plus optional `mergedFromRepos: []` for the toner/KND/snip
merge sources) to every record, surface it as "Open repo" on `/apps/[slug]`, and add a script + smoke
that lists the owner's repos and fails when a non-archive repo maps to no registry slug. **This is the
check that would have caught Operate's absence.** Still unmapped after #336: `solution-desk`,
`snip-landing` (classify or add), `ecosystem-keepwarm` (mark as infrastructure, not an app).

**3.5 Ops stats cache read capped at 200 rows.** `src/lib/engine/ops-stats.ts:403` — will silently start
discarding cached readings as build jobs accumulate.
*Fix:* scope the read to the targets being rendered (`where app_key = any(...)`) instead of a blind
limit, and prune rows whose `app_key` no longer matches a live target.

### Tier 4 — admin door correctness (builds on #336)

**4.1 Admin URLs ignore the registry's own `domain.servingUrl`, so a door can point at the wrong host.**
`src/lib/engine/portfolio-url-status.ts:97`.
*Fix:* make `domain.servingUrl` the first source in `toEntry()`. Separately, stop feeding `reviewUrl`
into admin-door construction — pass a distinct `adminHost` (production/serving only) into
`resolveAdminDoor` so a preview URL can never become an admin door.

**4.2 best-life's admin button is built from a guessed host** — `portfolio-url-status.ts:100`
synthesizes `https://<intendedDomain>` when status is `live`, contradicting the catalog's own "never a
guessed /admin" promise.
*Fix:* mark synthesized URLs (`servingUrlVerified: false`) and have `resolveAdminDoor` refuse a
relative door on an unverified host — return the `no_address` state #336 added, which already renders
an honest note.

**4.3 A live app that is currently DOWN still renders a working-looking admin button.**
`src/lib/engine/owner-deck.ts:29`.
*Fix:* carry the ops `unreachable` finding onto `DeckApp` as `reachable: boolean | null`, and render the
door degraded when `false` — "Admin ↗ — app is not answering right now". Pairs with 1.2.

**4.4 printer-protector-monitoring gets a rendered door with no deployment of its own.**
`src/lib/engine/app-ops-catalog.ts:310`.
*Fix:* add an `adminNote` ("Managed inside Toner Central — this agent has no front door of its own
yet"), and have `resolveAdminDoor` tag family-level doors so the UI can say "Family admin" rather than
"this app's admin".

### Tier 5 — drill-down leftovers

**5.1 Attention "Open →" links leave the desk, and the domain item points at the wrong place.**
`src/components/engine/owner-command-deck.tsx:200`. #336 added an in-desk path via the app-name link,
but the action link itself still goes external in the same tab.
*Fix:* `target="_blank" rel="noreferrer"` for external links, and re-point findings at the desk surface
that fixes them — `needs_domain` → `/domains?app={slug}`, `missing_env`/`features_unconfigured` →
`/integrations` (Vercel as a secondary action), `not_reporting` → `/apps/{slug}`.

**5.2 `/reports` usage table and AI-spend numbers are unlinked.** `reports/page.tsx:245`.
*Fix:* tickets → `/inbox?app={slug}`, orders → `/reports/money?stream={slug}`, users/active/new →
`/apps/{slug}`; AI cost card → a spend breakdown by day/app, each bar with an href.

**5.3 Money report: unreadable Stripe accounts and bought services are dead ends.**
`reports/money/page.tsx:117`.
*Fix:* link "no key on this desk" → `/integrations` (deep-link the slot when known), add a `?service=`
filter and link the service name to it, link the account cell to `href({account: sourceId})`.

### Tier 6 — look

**6.1 The real EasyPeazy component vocabulary is still only on the sign-in screen.**
`src/app/styles.css:6605`. #336 aliased `.desk-input` onto the search field and gave `.desk .panel` the
card recipe, but there is still no filled 48px primary button and no 48px input anywhere on the desk.
*Fix:* promote `.desk-btn`/`.desk-btn-primary` into the dossier action row and every primary CTA; drop
the `0 24px 60px rgba(2,6,23,0.45)` shadow onto `.desk .panel`. Note the card half is *mostly already
done* — do not duplicate the recipe under a new `.desk-card` alias.

**6.2 Six accent hues compete on the deck.** `src/app/styles.css:6014`.
*Fix:* one accent plus one positive and one alert — indigo for structure/links/labels, emerald only for
money-positive, pink only for needs-attention. Point `.dx-tag`, `.dx-index` at `var(--teal)` (the desk
indigo) and delete the hardcoded `#34d399`/`#22d3ee`/`#f472b6` at 6429-6431 so `.dx-stat--*` follows
its tokens.

**6.3 `--mono` names a font that is never loaded.** `src/app/styles.css:6351` — every small-caps label
silently falls back to the OS monospace.
*Fix:* decide once — load JetBrains Mono via `next/font` as `--font-desk-mono`, or drop mono from the
UI and keep a true monospace only for `.dx-mono` numeric cells and `.cred-var` code spans.

**6.4 No radius, spacing, or elevation scale** — eleven distinct radii.
`src/app/styles.css:6386`.
*Fix:* add `--r-sm/md/lg/pill` and `--sp-1..6` on `html.desk`, collapse all radii onto three values
(pill for chips, md for controls and stats, lg for cards). #336 removed the between-card inline margins;
the ones that remain are *inside* cards and are correct — don't strip those.

---

## 4. Also available: four smoke suites failing on `main`

These fail identically on pristine `main` and on #336 — verified in a clean worktree at `origin/main`.
None is caused by the desk work, and **none is run by CI**, so they gate nothing today:

| Suite | Failure |
|---|---|
| `smoke:owner-business-command` | `src/app/signin/page.tsx` missing the string `"Sign in to the desk"` — a one-line copy fix |
| `smoke:portfolio-url-status` | 10 checks: owner-confirmed domains (`toner.management`, `kidsneeddad.com`, `we-succeed.org`, `churchconnect.cloud`, `laser.engrave.market`, `snip.show`…) each expected on exactly one app |
| `smoke:ops-stats` | `src/lib/engine/app-generator.ts` missing the `users.created_at` ALTER string |
| `smoke:live-portfolio-state` | `owner-portfolio-dashboard.tsx` missing `registry.summary.byStateSource.live_state` |

Each is small and self-contained. Good warm-up work, and fixing `portfolio-url-status` overlaps with
3.4 (repo mapping) and 1.1 (roster unification).

---

## 5. Conventions that must hold

Break any of these and you have made the desk worse, whatever else the change does:

1. **Never render a number you cannot source.** No `0` for "unknown", no `$0.00` for "unattributed",
   no count for "not reporting". A dash is fine — a dash *with its reason on the same row* is better.
2. **Never guess an admin path.** A door is recorded only when the path exists in that app's code. The
   `no_address` / `none` states exist so an absence can be explained instead of faked.
3. **Never let a stat be a dead end.** If the desk shows a figure, that figure opens where it came
   from. A smoke guard enforces this for `dx-stat` tiles.
4. **One dashboard.** Ops lives in AppEngine; the UUG site later reads the *same* collector for a
   public view. Never build a second dashboard — the two-roster bug in 1.1 is what that mistake looks
   like in practice.
5. **Reuse the guards and helpers #336 added** — `canonicalSlug()`, `isKnownAppSlug()`,
   `streamSlugForApp()`, `isRevenueWired()`, `ADMIN_DOOR_REASON`, and the `dx-*` utilities. They exist
   because each of them was a bug first.

---

## 6. How to verify

CI (`.github/workflows/pr-verification.yml`) runs exactly these — run them locally before pushing:

```bash
export APP_ENGINE_LOCAL_MODE=true AUTH_SECRET=ci-auth-secret \
       AUTH_URL=http://localhost:3000 SOURCE_CHECK_OFFLINE=true
npm run source:check && npm run generated-apps:guard && \
npm run dupes:check && npm run typecheck && npm run build
```

To see the desk itself — it only renders on the `dashboard.` hostname:

```bash
npm run dev                     # NODE_ENV=development bypasses the admin gate
curl -H "Host: dashboard.localhost" http://127.0.0.1:3000/
```

For screenshots, Chromium needs the host mapped:

```
--host-resolver-rules="MAP dashboard.localhost 127.0.0.1"
```

Then re-run the desk smokes: `smoke:owner-business-command`, `smoke:owner-portfolio-dashboard`,
`smoke:portfolio-registry-canonical`, `smoke:ops-stats`, `smoke:portfolio-url-status`.

---

## 7. Decisions for Lincoln — do not invent these

1. **Where the missing counts come from** (2.1). A read-replica URL per app, a counts endpoint, or
   accept the gap and show the reason. This is an architecture and possibly a cost decision.
2. **Whether cost data gets entered by hand** (2.10). Hosting cost per app has no automatic source.
3. **Operate's live state.** Its registry entry in #336 was written from its repo README and
   `AGENTS.md`; outbound network was blocked in that session, so nobody has confirmed the live site
   answers. One glance settles it.
4. **Whether the `operate` revenue classifier stays** (#336 added it). Billing is off today per
   Operate's `AGENTS.md`, so the money report reads "no labeled charges" until it turns on.
5. **Anything touching mission, philosophy, doctrine, or what an app IS.** Consume it; never author it.

Everything else in §3 is autonomous per the owner authority directive (2026-07-09): build, test, merge,
deploy, verify, then report. Back up before destructive DB operations, keep deploys reversible, verify
end-to-end.
