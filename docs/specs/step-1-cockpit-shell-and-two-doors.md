# Step 1 — Cockpit shell + two clear front doors

**Repo:** `lincolnnunnally/AppEngine` · **Branch:** `feat/cockpit-shell-and-two-doors` · **Owner:** Lincoln (all merges owner-approved after PR Verification passes)

## Goal

Give the operator surface a single, calm navigation shell (a left rail grouped by the build journey) and replace the current scattered home page with two obvious front doors. This is the first step of a larger plan; it is deliberately UI-only and additive. No business logic, data, auth, or pipeline behavior changes.

## Why (context for the implementer)

AppEngine has two intakes by design: a visionary's door (the `opportunity-intake` family) and a public "I see a problem but don't know how to fix it" door (the `problem-intake-lite` family). Today the home page is a flat top-nav of six links plus a five-button action row feeding ~16 co-equal panels, so the operator has no clear starting point and no sense of place. Step 1 fixes that framing. Later steps connect the pipeline, close the build/deploy gaps, and add the people-matching layer — all out of scope here.

## Guardrails (non-negotiable — this is a "build alongside" change)

1. **Additive only.** Do not delete, rename, or move existing `lib` modules, components, routes, or business logic. Do not change the fields or behavior of either intake form.
2. **Do not edit existing CSS classes.** `styles.css` already defines `shell`, `topnav`, `navlinks`, `panel`, `eyebrow`, `card`, `grid`, `action-row`, `button`, `metric-card`, `wide-card`, `panel-list`, `session-note`, etc. Leave every existing rule intact so current pages keep rendering. Only add new classes.
3. **Reuse the existing design tokens** in `src/app/styles.css` `:root` (see Appendix B). Do not introduce a new color system, Tailwind, or any CSS framework. Keep the warm palette.
4. **Preserve every URL.** Use a Next.js route group (the `(group)` segment is not part of the path), so `/builder` etc. stay exactly the same.
5. **Public pages keep their simple layout.** The cockpit rail is for the operator only. If a route's audience is unclear, leave it OUTSIDE the cockpit group (unchanged) and flag it in the PR for Lincoln to confirm. Never add operator chrome to a public-facing page by guessing.
6. **No new dependencies.** No DB, migration, secret, env, deploy, or paid-resource changes.
7. **Mobile-first.** The operator frequently uses an iPhone. The shell must be fully usable on a narrow screen with no horizontal scrolling.

## Scope

### In scope
- A new `AppShell` layout component (rail + header + content slot).
- A cockpit route group whose layout renders `AppShell` around operator pages.
- A redesigned operator home (`/`) presenting two primary doors.
- Additive `styles.css` rules for the shell, rail, header, and door cards, plus light hierarchy/contrast improvements (headings, surface separation) that do not touch existing classes.

### Out of scope (do NOT do in this branch)
- Wiring intakes into the clarify → candidate → packet → build pipeline (Step 2).
- Real agent runs, deploy automation, persistence activation (Step 3).
- People-to-people matching / collaboration (Step 4).
- Any change to auth, roles, DB schema, or the intake forms' fields.

## Deliverables

### 1. `AppShell` component — `src/components/engine/app-shell.tsx`
- Client component (`"use client"`) so it can read the active route with `usePathname()` from `next/navigation`.
- Props: `{ children: React.ReactNode }`.
- Structure:
  ```
  <div className="app-shell">
    <aside className="app-rail"> brand + grouped nav + footer identity </aside>
    <div className="app-main">
      <header className="app-header"> current section name + (empty action slot) </header>
      <div className="app-content">{children}</div>
    </div>
  </div>
  ```
- Rail nav uses ONLY routes that exist today (see Appendix A for the exact group→item→href map). Mark the current item with an `active` class by comparing `usePathname()` to each item's href.
- Header: a thin bar showing the current section label (derive from pathname, fall back to "App Engine"). Leave a right-aligned empty slot for a future primary action — do not wire any action now.
- Footer identity: if a session helper is already trivially importable, show the owner email; otherwise render a static "Owner" label. Do not add new auth logic.
- Mobile behavior (required): below ~860px, hide the vertical rail and show a top bar with a menu toggle (`<button>` controlling a `data-open` state) that reveals the nav as an in-flow slide-down panel. Do not use `position: fixed`. No horizontal overflow at 380px wide.

### 2. Cockpit route group — `src/app/(cockpit)/layout.tsx`
- Create `src/app/(cockpit)/layout.tsx` that renders `<AppShell>{children}</AppShell>`.
- Move these operator pages into the group (folders move into `src/app/(cockpit)/…`; URLs stay identical because `(cockpit)` is a non-path segment):
  - `/` (home dashboard) → `src/app/(cockpit)/page.tsx`
  - `/builder`
  - `/owner-control-center`
  - `/opportunity-intake`
  - `/life-core`
  - `/admin`
- Leave these OUTSIDE the group, untouched (they keep the existing minimal root layout and their own page chrome):
  - `/problem-intake-lite` (public door)
  - `/spark-of-hope-intake-lite` (public generated-app intake)
  - `/account` (customer-facing)
- Do not modify the root `src/app/layout.tsx` (it imports `styles.css` and wraps `<html><body>`; both layouts will nest correctly).
- If moving any page reveals a relative import, update it to the correct path. Verify each moved route still loads at its original URL.

### 3. Operator home → two doors — `src/app/(cockpit)/page.tsx`
- Remove the in-page `<nav className="topnav">…</nav>` block and the five-button `action-row` (the rail now handles navigation). Keep the `topnav` CSS class defined in `styles.css` for any page still using it — just stop rendering it here.
- Replace the hero with a two-door layout as the primary content (copy in Appendix C):
  - Door 1 — "I have a vision to build" → links to `/opportunity-intake`.
  - Door 2 — "I see a problem and need help" → links to `/problem-intake-lite`.
- Keep the existing "Recommended Stack" starter cards, but move them below the doors as secondary content (they're fine as-is; just lower in the visual hierarchy).

### 4. `styles.css` additions (append a new clearly-commented section)
Add new rules only, using existing tokens. Suggested classes: `.app-shell`, `.app-rail`, `.rail-brand`, `.rail-group`, `.rail-group-label`, `.rail-item`, `.rail-item.active`, `.app-main`, `.app-header`, `.app-content`, `.door-grid`, `.door-card`, `.door-card-icon`, plus the `@media (max-width: 860px)` rail-collapse rules.

Style intent (match the approved mockup):
- Rail background `var(--panel)` with a `border-right: 1px solid var(--line)`; page/main background `var(--paper)`.
- `.rail-item` text `var(--muted)`; on hover, subtle `var(--green-soft)` background; `.rail-item.active` uses `var(--teal)` background with white text (or `var(--green-soft)` background with `var(--teal)` text — pick the one with stronger contrast in the live app).
- `.door-card`: white (`var(--panel)`) surface, `1px solid var(--line)`, generous padding, `var(--shadow)` on hover, a `var(--teal)` accent (icon or top border). One clear title + one line of supporting text each.
- Raise general hierarchy a touch: larger/heavier `h1` in `.app-content`, and ensure cards visibly separate from the `--paper` background via the existing `--line` border and `--shadow`. Do this with NEW selectors scoped under `.app-content` / `.app-shell`, not by editing existing global rules.

## Acceptance criteria
- The app builds and the existing PR Verification workflow passes.
- All nine routes still load, at their original URLs (route group preserves paths).
- The vertical rail appears on the operator routes listed in Deliverable 2 and does not appear on `/problem-intake-lite`, `/spark-of-hope-intake-lite`, or `/account`.
- The operator home shows exactly two primary doors that navigate to `/opportunity-intake` and `/problem-intake-lite`.
- Every existing page's content renders as before (no existing CSS class was altered).
- Usable on a 380px-wide phone: rail collapses to a toggle, no horizontal scrolling.
- No new dependencies; no changes to auth, roles, DB, secrets, env, or any intake form fields.

## Commit & PR
- Small, readable commits.
- PR description should state: "Additive cockpit shell and two-door home. UI only. No production deploy, env changes, secrets, migrations, paid resources, or business-logic changes. URLs preserved via route group."
- Open the PR for owner review; let PR Verification run. Do not merge.

## Appendix A — Rail nav map (Step 1, live routes only)
Group the nav by the build journey, but in Step 1 only link to routes that exist. Later steps will add Portfolio (candidates, packets), Build sub-pages (phases, runs, handoff), and Ship (readiness, deploy) as those routes are created.

- **Home**
  - Dashboard → `/`
- **Intake**
  - Vision intake → `/opportunity-intake`
  - Problem intake → `/problem-intake-lite`
- **Build**
  - Builder → `/builder`
  - Owner control → `/owner-control-center`
- **Ecosystem**
  - Life Core → `/life-core`
- **Settings** (rail footer, smaller)
  - Admin → `/admin`

(`/account` and `/spark-of-hope-intake-lite` are public/customer-facing and are not in the operator rail.)

## Appendix B — Existing design tokens (from `src/app/styles.css` `:root`)
Use these; do not invent new colors.

- `--ink: #17211b` — primary text
- `--muted: #66736c` — secondary text
- `--line: #d9d4ca` — borders/dividers
- `--paper: #f6f3ed` — page background
- `--panel: #ffffff` — card/surface background
- `--teal: #127c73` — primary accent / active state
- `--green-soft: #e7f3ef` — subtle accent background
- `--coral: #c9553d`, `--gold: #b98d22`, `--blue: #456ea8` — secondary accents
- `--shadow: 0 18px 48px rgba(23, 33, 27, 0.08)` — card elevation
- Font family: Inter (already set on `:root`)

## Appendix C — Door copy
- **Door 1**
  - Title: "I have a vision to build"
  - Support: "Clarify the idea, shape the solution, and orchestrate it into a real app."
  - Links to: `/opportunity-intake`
- **Door 2**
  - Title: "I see a problem and need help"
  - Support: "Describe a problem and get guided to a safe first step — no tech experience needed."
  - Links to: `/problem-intake-lite`
