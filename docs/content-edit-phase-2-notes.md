# content-edit — Phase 2 design notes (drag-reorder + spacing)

**Status: design only. Do not build until the owner pulls Phase 2 forward.**
Phase 1 (shipped): owner-gated Edit mode → click any text to edit wording inline +
size/weight/color tokens → persisted to `content_overrides` keyed by
`(page, element_path)` → applied at render for every visitor. This note records how
that schema extends to Phase 2 — section drag-reorder and spacing controls — so
Phase 2 is an **additive migration**, never a rework of Phase 1 rows.

## What Phase 1 already established

- **Element path grammar:** `tag:nth-of-type(i)` segments joined by `>`, rooted at
  `<body>` (e.g. `main:nth-of-type(1)>h1:nth-of-type(1)`). Validated server-side
  against exactly this grammar, so a row can never hold a selector we didn't mint.
- **One row per (page, element path)**, `original_text` captured on first save and
  never overwritten — reset always returns to what the code shipped.
- **Token discipline:** style is stored as token *names* (`size`, `weight`,
  `color`) that a runtime stylesheet maps onto the app's CSS variables. Never raw
  CSS values in the database.
- **Runtime owns the whole apply pass** (fetch → resolve paths → mutate DOM),
  which is the property Phase 2 leans on hardest — see ordering, below.

## Phase 2 scope

1. **Drag-reorder of sections** — move whole blocks (a hero, a card row, a
   testimonial band) up/down a page.
2. **Spacing controls** — token-based top/bottom spacing per element or section.

## Schema extension (additive only)

```sql
alter table content_overrides
  add column if not exists kind text not null default 'text',   -- 'text' | 'section'
  add column if not exists order_index integer,                  -- kind='section' only
  add column if not exists space_top text,                       -- spacing token or null
  add column if not exists space_bottom text;                    -- spacing token or null
```

- Every Phase 1 row is `kind='text'` by default — no data migration.
- A **section row** reuses the same path grammar, but its path points at a
  section-level container (in generated apps: the direct children of `main`;
  ported apps can widen eligibility by marking containers with `data-ce-block`).
  A section's path is a *prefix* of the paths of any text edits inside it —
  that prefix relationship is what lets reorder and text edits compose.
- `order_index` is a plain integer ranking among that page's section rows.
  Sections with no row keep their source order (stable partial ordering) —
  identical in spirit to "no override row = page exactly as coded" from Phase 1.
- Spacing tokens follow the Phase 1 token discipline: `space_top`/`space_bottom`
  hold names from a fixed scale (`none | s | m | l | xl`), rendered as
  `data-ce-space-top` / `data-ce-space-bottom` attributes mapped to a CSS-var
  spacing scale (`--ce-space-s` … with sensible em/rem fallbacks). Spacing columns
  are valid on BOTH kinds — a text row may carry spacing without becoming a section.

## The path-stability problem reorder introduces (and its answer)

`nth-of-type` indexes are positional, so *physically moving* sections would strand
every text path inside them. The fix is an ordering rule in the runtime, not a
schema change:

> **All stored paths are interpreted against SOURCE order.** The apply pass runs:
> (1) resolve + apply all `kind='text'` rows against the DOM as the server
> rendered it, (2) THEN apply section reordering by moving nodes.

Because the runtime owns both passes, paths never need to know about reorder.
The reorder pass records each section's original position (a WeakMap of node →
source index) so repeated applies (the runtime re-applies after hydration and on
navigation) stay idempotent. Saving a *new* text edit while sections are
reordered must compute the path against source order too — the WeakMap gives the
inverse mapping.

Rejected alternative: minting persistent block ids (`data-ce-id`) into app source.
That would require touching every app's markup, which breaks the module's core
promise (drop-in, zero source edits) — and it still wouldn't help elements the app
renders from data.

## API extension

Same route (`/api/content-overrides`), same guards (public GET, `canAccessAdmin`
POST/DELETE). POST accepts the new optional fields with the same
validate-against-allowlist pattern: `kind` ∈ {text, section}, `order_index` a
bounded integer, spacing tokens ∈ the fixed scale. GET returns rows of both kinds;
old runtimes ignore fields they don't know, so mixed deploys stay safe.

## Edit-mode UX (sketch)

- The Phase 1 toggle grows a second mode: **Move sections**. Entering it overlays
  a handle (data-ce-ui) on each eligible section; drag or press ↑/↓ to reorder
  (keyboard path is the accessibility story, same as Phase 1's Enter/Esc).
- Spacing joins the Phase 1 toolbar as a fourth row (Space: none/S/M/L/XL for
  top and bottom) — no new surfaces, same save/reset/cancel lifecycle.
- `/admin/content` lists section rows with a "restore original order" action,
  exactly parallel to text-row removal.

## Known Phase 1 limitations Phase 2 should keep in view

- **Mixed-content flattening:** editing a `<p>` that holds a `<strong>` saves
  flattened plain text (shown live before saving, so never a surprise). True rich
  text would need a whitelisted-markup editor — out of scope for Phase 2 as well
  unless the owner asks.
- **Data-driven lists:** paths point at *positions*, so an edit to "the third
  testimonial" follows the position, not the record. Fine for static marketing
  copy (the Phase 1 use case); content that comes from the database should be
  edited in the database.
- **Dynamic routes:** each concrete URL is its own page key. If per-pattern
  overrides are ever wanted (`/products/[id]` sharing one set), add a
  `page_pattern` column and match it in `listOverrides` — additive again.
