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
