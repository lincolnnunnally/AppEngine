# Ecosystem Owner Rulings

> Durable record of decisions Lincoln has made so agents stop re-asking them.
> When one of these is questioned, point here and move on. Newest ruling wins;
> supersede in place with a date.

## 2026-07-04 — Database placement: one shared Supabase for the whole ecosystem

**Every ecosystem app uses the shared Life Produces Life Supabase** (project ref
`uqhqulrqcygsmmzdzemx`). Rationale (Lincoln): the apps' components are deeply
intertwined and people use multiple apps under one identity, so a single shared
identity/database is what makes the ecosystem work — this was Claude's
recommendation and is the owner's ruling.

**The only exception** is a **customer's own app built through AppEngine**: those
get an isolated, auto-provisioned **free Neon** database. We don't need or see that
customer's data and it isn't wired into our ecosystem — but we still benefit from
the modules/improvements their build produces by adding them to the shared catalog.

Decision rule: *mission/ecosystem app → shared Supabase; end-customer generated app
→ its own Neon.* (Consistent with `CURRENT_SCOPE.md`'s locked line; now explicit.)

## 2026-07-04 — Toner is a product family, not one canonical app

There will be **multiple Toner apps** sharing one core, presented to different
audiences and business models:

- **Our-suppliers model:** the customer pays for printer monitoring, then pays for
  toner that we auto-order from **our** suppliers.
- **Their-suppliers model:** we monitor the printers and order toner from the
  customer's **own** suppliers, charging a small automated-ordering fee.
- **Individual/small** (one or two printers) vs **enterprise** (their own IT staff,
  who want control).

The old repo intended as the **admin hub** for all the toner apps is being
**absorbed into the universal ops dashboard** (AppEngine), so that piece should be
adjusted/folded rather than launched standalone.

Implication for the portfolio: Toner canonicalization is **not** "pick one repo and
archive the rest." It is "recognize the family, share the core, and route the admin
role into the dashboard." Keep the audience variants as distinct front-ends over the
shared core + shared Supabase.

## 2026-07-04 — Bring these apps onto our own services (off Emergent)

Make functional on Lincoln-owned infra (Vercel + Render + shared Supabase), not
Emergent:

- **Public Pulse** — civic-engagement app (help citizens steer politicians; advocate
  a **consumption tax** replacing the current complicated/excessive tax system).
  Introduced ~2026-07-01; reportedly already running on Emergent. Bring it over.
- **Kindred** — off Emergent onto our infra (friendship-first; the dating variant is
  the separate **Aligned Souls** app).
- **Kids Need Dads / RebuildingDads** — make functional on our services; canonical
  base is **RebuildingDads** (it has full history), KND-google-ai is merge-source,
  dads-recovery is a backup only.

## 2026-07-04 — The shared LPL database is the permanent home for everything Lincoln builds

Extends the database-placement ruling above to be explicit: **every app Lincoln
creates** — journey apps, business apps, and shared modules — lives on the shared
Life Produces Life Supabase (`uqhqulrqcygsmmzdzemx`) as its permanent home. One
shared identity + database is what lets a person move across his apps as one user.
Unchanged exception: an **end-customer's** app generated *through* AppEngine gets its
own isolated free Neon (we don't see or wire that data). Decision rule stays:
*anything Lincoln builds → shared Supabase; a customer's generated app → its own Neon.*

## 2026-07-04 — Opportunity is its OWN app (resolves D2 / ECO-007)

The Opportunity Engine becomes a **standalone app that leverages AppEngine** as its
builder/runtime — not merely a door inside We Succeed. Its distinguishing component,
beyond intake/routing: it **connects people around an opportunity to solve a problem
together** (matching a problem-owner with people who can help). Path B (extraction via
a transfer ledger + its own domain), not the docs-only closure. It is a DIFFERENT app
from Ideas (below).

## 2026-07-04 — Ideas is a distinct app: capture → content engine

Ideas ≠ Opportunity. Opportunity connects people to solve problems; **Ideas turns
Lincoln's scattered notes into content and larger works.** Today his ideas are strewn
across ClickUp, Evernote, Apple Notes, GoodNotes, journals — and collect dust. The
Ideas app captures them in one place (including a one-press iPhone voice capture that
transcribes), catalogs them as a content library, turns each into content (social
post, blog, book chapter, sermon, app idea, app improvement, message to send…), runs a
**daily automation** that picks an idea and drafts a post, and **compiles** the library
into larger works (a book, a preaching series, a speaking tour). Its own app on shared
LPL infra. Full spec: `source-of-truth/design/ideas-app.md`.

## 2026-07-04 — We Succeed URL may move to Pulse (DIRECTION — do NOT act yet)

Lincoln is leaning toward **we-succeed.org becoming the home of the Pulse** civic app
(petition-gathering / "a Kickstarter for legislation" — e.g. the consumption-tax
campaign to connect citizens with politicians), rather than AppEngine's public URL.
AppEngine (the factory) would then take a NEW public identity/URL. **This is not final
and must not be executed** — we-succeed.org is live production. Do not repoint the
domain, rebrand the factory, or change `APP_ENGINE_PUBLIC_ACCESS` targeting until
Lincoln confirms. Recorded so the direction isn't lost and nobody hard-codes "We
Succeed = AppEngine" as permanent.
