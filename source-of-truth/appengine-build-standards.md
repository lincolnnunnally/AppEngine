# AppEngine Build Standards

The standards AppEngine follows when it builds a customer's app. Adapted from the
AIPOS methodology (ChurchConnect/AIPOS: STANDARDS, VERSION_LOOP, REUSE_REGISTRY) —
a proven AI-agent build discipline — and bound to AppEngine's own pipeline.

## 1. Reuse before generate (THE ONE RULE)

- Before generating a capability, **check the Module Catalog** (`module-catalog.md`)
  and reuse the existing block — never rebuild a block that already exists.
- The catalog is AppEngine's reuse registry. Each block's `primarySource` names the
  real files to mine. Built components feed back into the catalog for future builds.
- Keep each build scoped; don't do broad cleanup or invent architecture mid-build.

## 2. Completion gates — "live" must be verified, not assumed

A build is only reported **live** when verification passes, not merely when a tool
says "done". AppEngine's customer build enforces:

- the generated app **builds** on Vercel (deployment reaches `READY`), and
- the deployed **URL actually responds** (`verifyDeployedApp` — the completion
  gate), surfaced honestly as `verified` in the build status.

Future gates to add as the pipeline matures: a health endpoint check, and the
post-publish walkthrough of every door/button (the scope's verify-after-publish).

## 3. Isolation + data placement

- **Each customer app gets its own isolated Neon database** (free tier),
  provisioned per build; its schema is applied before the app goes live.
- **Lincoln's ecosystem apps live on the shared Supabase** (Life Produces Life
  identity/data) — customer apps never share it.

## 4. Secrets + deployment

- Secrets live in the owner **Integrations** dashboard (→ Vercel env) or provider
  dashboards — **never** hardcoded, never in generated frontend code, never a
  service-role key shipped to the client.
- Each app deploys to **its own Vercel project under the owner account**; new
  projects have deployment protection disabled so the customer can view the app.
- Paid/irreversible actions (real deploys are free; **domain purchases cost money**)
  require explicit confirmation — never automatic.

## 5. Version loop

- The first version is a **real, live, working starter** — not the final product.
- Improvements come from the customer's review after they see it live; take one
  next change at a time.
