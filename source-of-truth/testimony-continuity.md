# Testimony Continuity — EXIST doors only

Lincoln ask: testimony must work for sharers and be easy to find for people needing encouragement. Spark of Hope and sibling hope apps share philosophy, not purpose.

This file maps what **AppEngine owns** versus what it only **documents**. It does not invent a mega-hub, a new app, SingTrue, or a ChurchConnect TestimonyHub door. Do not deploy from `spark-of-hope-vercel-recovery`.

Verified 2026-09-20.

## What AppEngine owns

| Surface | Path | What it is |
| --- | --- | --- |
| Factory brick | `src/lib/engine/modules/testimony-engine.ts` | Generates `/testimonies` share, read, and `/testimonies/review` for composed apps. Not a live AppEngine public wall. |
| Intake-lite preview | `/spark-of-hope-intake-lite` | Private local/mock story intake + owner review queue. Live on App Engine at `https://appengine.unitedundergod.org/spark-of-hope-intake-lite`. Does not publish to Spark or Live On Mission. |
| Apps directory | `apps.unitedundergod.org` | Lists Spark and Live On Mission as sibling apps. Quiet door links only — not a testimony hub. |
| Charters / SoT | `source-of-truth/**/spark-of-hope-intake-lite*` | Pilot charter, architecture, data model. Not the full Spark product. |

## What AppEngine only documents

| Product | Repo that must stay owner | Live door |
| --- | --- | --- |
| Spark of Hope | Spark live app (not this factory preview). Recovery archive `lincolnnunnally/spark-of-hope-vercel-recovery` is HOLD — do not deploy from it. | Home / being-heard write: `https://spark.unitedundergod.org/`. Find: `https://spark.unitedundergod.org/hope-stories`. Equivalent host `spark-of-hope.com` serves the same app. |
| Live On Mission testimonies | `lincolnnunnally/live-on-mission` | Share + read: `https://liveonmission.unitedundergod.org/testimonies`. Review: `/testimonies/review` (sign-in). Equivalent host `live-on-mission.com`. |
| ChurchConnect testimony lineage | `lincolnnunnally/ChurchConnect` | Factory module was ported from `backend/routes/testimonies.py`. Public `/testimonies` and `/testimony-hub` on churchconnect.unitedundergod.org are the generic homepage — **not** a live TestimonyHub door. |

## Verified EXIST URLs

### Share / be heard

- `https://spark.unitedundergod.org/` — write without an account; words stay in the browser session. Spark purpose: being heard. HTTP 200.
- `https://liveonmission.unitedundergod.org/testimonies` — factory testimony-engine share form + empty find wall. Sign-in required to share (`/sign-in?next=/testimonies`). HTTP 200. Same page on `https://live-on-mission.com/testimonies`.
- `https://appengine.unitedundergod.org/spark-of-hope-intake-lite` — AppEngine private preview only.

### Find / encouragement

- `https://spark.unitedundergod.org/hope-stories` — Hope Stories find door. Copy on the page: curated starter stories, not a live approved testimony feed. HTTP 200. Same page on `https://spark-of-hope.com/hope-stories`.
- `https://liveonmission.unitedundergod.org/testimonies` — reviewed-testimony find wall (empty as of verification: “No stories yet”).

### Not doors (do not link as if they were)

- `https://spark.unitedundergod.org/testimonies` — 404
- `https://spark.unitedundergod.org/share` — 404
- `https://spark.unitedundergod.org/stories` — 404
- `https://spark.unitedundergod.org/admin` — 404
- `https://churchconnect.unitedundergod.org/testimonies` — generic ChurchConnect homepage, not TestimonyHub
- `https://churchconnect.unitedundergod.org/testimony-hub` — same generic homepage

## Continuity rules

- Apps share philosophy, not purpose. Spark = being heard + Hope Stories. Live On Mission = practical service + reviewed testimonies. Intake-lite = factory preview.
- Directory/SSO Continuity may href EXIST sibling doors. That is not importing those apps' workflows or sharing story data.
- Do not invent a cross-app testimony mega-hub inside AppEngine.
- Do not rebuild Spark from this repo. Do not deploy from `spark-of-hope-vercel-recovery`.
- ChurchConnect TestimonyHub, if it exists later, stays in the ChurchConnect repo until a public path is verified.

## Code homes in this repo

- EXIST URL constants: `src/lib/spark-of-hope-intake-lite/live-doors.ts`
- Intake-lite next-step links: `src/app/spark-of-hope-intake-lite/page.tsx`
- Showcase door links: `src/lib/showcase/apps-showcase.ts`
- Factory brick: `src/lib/engine/modules/testimony-engine.ts`
