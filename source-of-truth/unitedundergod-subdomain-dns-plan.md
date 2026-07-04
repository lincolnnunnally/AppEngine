# United Under God — subdomain DNS plan (Cloudflare)

> **Goal:** give every ecosystem app its own subdomain under `unitedundergod.org`
> (e.g. `appengine.unitedundergod.org`, `churchconnect.unitedundergod.org`), and
> let AppEngine create those subdomains **automatically** as it deploys apps.
>
> **Owner decision (2026-07-04):** DNS hub = **Cloudflare** (free; Lincoln already
> has an account). Chosen over Vercel DNS because the estate spans Vercel + Render
> + Netlify + DreamHost, and Cloudflare is host-agnostic with a first-class API.
>
> **Key principle: the WordPress site does NOT move.** We move only *DNS authority*
> (the nameservers). The apex `unitedundergod.org` + `www` keep pointing at the
> DreamHost WordPress exactly as today. Email keeps working. Zero site rebuild.

---

## Why a DNS move is needed at all

`unitedundergod.org` today: **registrar** Spaceship · **DNS** delegated to DreamHost
(`ns1/ns2/ns3.dreamhost.com`) · **WordPress** on DreamHost shared hosting at
`67.205.20.0` · **email** via DreamHost/MailChannels.

DreamHost's DNS has no good API for programmatic record creation (no clean wildcard,
no automation). So the factory can't mint subdomains on its own while DNS lives
there. Moving DNS to Cloudflare gives an API the factory can drive — without
touching the website or email.

---

## Current DNS inventory — the safety net (captured 2026-07-04, read-only `dig`)

Cloudflare's zone-scan will import most of these automatically, but **verify each
one is present before flipping nameservers** — a missing MX/SPF/DKIM record breaks
email. Recreate by hand anything the scan misses. Record exactly:

| Type | Name | Value | Notes |
|---|---|---|---|
| A | `unitedundergod.org` (apex) | `67.205.20.0` | WordPress. Import as **DNS only / grey-cloud** first (see below). |
| A | `www` | `67.205.20.0` | WordPress. Grey-cloud first. |
| A | `mail` | `64.90.62.162` | DreamHost mail — **keep, grey-cloud (never proxy mail)**. |
| A | `webmail` | `69.163.136.138` | DreamHost webmail — keep, grey-cloud. |
| A | `ftp` | `67.205.20.0` | DreamHost FTP — keep, grey-cloud. |
| MX | `unitedundergod.org` | `mx1.mailchannels.net` (pri 0), `mx2.mailchannels.net` (pri 0) | **CRITICAL — email. Copy exactly.** |
| TXT | `unitedundergod.org` | `v=spf1 mx include:netblocks.dreamhost.com include:relay.mailchannels.net -all` | SPF — copy exactly. |
| TXT | `dreamhost._domainkey` | `v=DKIM1; k=rsa; h=sha256; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1d5aqtikzWuiIlRmcfDlhZYh2bDlbrAjNt3Ykdi0Bxnt+hn7GflYj1P9S/Tv/44/bikqFfwz/nLF0cvNTcPtiheH6mCGrI8AANIHfuBmnDhELwqoMnGtRjFvE2ZI1QB5wslUi2hctcK/Jp33TndN0k9K3HGx+cYaSsUHQnlEkIHIT5cO0vMuPwCUaWtemh4CEfAOttPdBxb3ilA7J7ORBwnjyewQmS3nUHIgI5vlfhQiVeZ7NdJ+BVcFO4sldOJ3Sb8I1TQKoKkfRVzK/I4EoagoQYMDM6/DAwQRttgtE6uaTVhl/skfGwvTvVZ+DyKEXi8CMcFm0NLD5Lgxx/6B6QIDAQAB` | DKIM email signing — **long key, verify it imports whole**. |

No AAAA, no DMARC, no CAA today. (Optional later: add a DMARC record and a CAA
record once on Cloudflare — hardening, not required for the move.)

> If DreamHost's panel shows any records not listed here (extra subdomains,
> verification TXTs), copy those too. The list above is what was resolvable
> externally on 2026-07-04; the DreamHost DNS panel is the authoritative source —
> screenshot it before starting.

---

## Migration runbook (safe order — email stays up)

**Step 0 — capture.** In the DreamHost panel, open Manage Domains → DNS for
`unitedundergod.org` and screenshot the full record list. Compare to the table above.

**Step 1 — add the zone to Cloudflare.** In Lincoln's Cloudflare dashboard: Add a
Site → `unitedundergod.org` → choose the **Free** plan. Cloudflare scans existing
DNS and imports what it finds. *(This step needs the Cloudflare login — Lincoln does
it, or gives an API token and I do it, see "Automation" below.)*

**Step 2 — verify records BEFORE any nameserver change.** In Cloudflare's DNS tab,
confirm every row in the table above is present and exact — especially the **MX**,
**SPF TXT**, and **DKIM TXT** (the long one). Add any that didn't import.
Set the apex `A`, `www`, `mail`, `webmail`, `ftp` to **DNS only (grey cloud)**, not
proxied — proxying the apex would put Cloudflare in front of WordPress before we've
tested that, and proxying mail hosts breaks email. Grey-cloud = Cloudflare answers
DNS but traffic goes straight to DreamHost, identical to today.

**Step 3 — change nameservers at the registrar (Spaceship).** Cloudflare shows two
assigned nameservers (e.g. `x.ns.cloudflare.com` / `y.ns.cloudflare.com`). In
Spaceship → `unitedundergod.org` → Nameservers, replace the three DreamHost NS with
Cloudflare's two. **This is the one irreversible-ish, owner-only step** (needs
registrar login). Propagation: usually minutes, up to 24–48h.

**Step 4 — verify after propagation.** `dig NS unitedundergod.org` shows Cloudflare;
the WordPress site still loads at the apex + `www`; send/receive a test email.
Nothing should have visibly changed — that's success.

**Rollback:** if anything misbehaves, set the Spaceship nameservers back to
DreamHost's three. Because we grey-clouded everything, there is no traffic
interception to unwind.

---

## Subdomain naming convention

One label per app, matching the registry `slug` where sensible:

| App | Subdomain |
|---|---|
| AppEngine / We Succeed | `appengine.unitedundergod.org` (or keep `we-succeed.org` as the public face; a subdomain can alias it) |
| ChurchConnect | `churchconnect.unitedundergod.org` |
| Laser Engrave | `laser.unitedundergod.org` |
| Iconium | `iconium.unitedundergod.org` |
| …each app | `<slug>.unitedundergod.org` |

Apps that already own a public domain (live-on-mission.com, snip.show, milstead.us,
etc.) can *also* get a UUG subdomain as an alias, or keep their own — that's a
per-app call, not blocked by this move.

---

## After the move: automatic subdomain creation

Once DNS is on Cloudflare, creating `x.unitedundergod.org` is two API calls the
factory can make with no human step:

1. **Cloudflare API** — create a `CNAME` (or `A`) record `x` → the app's host
   (e.g. `cname.vercel-dns.com` for a Vercel app, or the Render/other host).
2. **Host attach** — add the custom domain to the app's project so it issues a TLS
   cert (e.g. Vercel "add domain" via the token AppEngine already holds; Cloudflare
   also offers Universal SSL if proxied).

**What the factory needs (one-time):** a scoped **Cloudflare API token** — permissions
`Zone.DNS:Edit` limited to the `unitedundergod.org` zone (least privilege; not the
global key). Store it as `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID` in the shared
env source (`env/shared-ecosystem.env.example`, per the #244 composer standard) —
never in git. Then AppEngine's deploy flow adds a "publish at `<slug>.unitedundergod.org`"
step: create the CNAME, attach the domain, verify the cert, health-check the URL.

This becomes a small **Cloudflare DNS adapter** in the factory (sibling to the Vercel
deploy adapter) — build it once, every future app gets an auto-subdomain. Tracked as
a follow-on build item; not part of this DNS move.

---

## Who does what

| Step | Who | Why |
|---|---|---|
| Screenshot DreamHost DNS (Step 0) | Lincoln | Needs DreamHost login |
| Add zone to Cloudflare + verify records (Steps 1–2) | Lincoln, **or** Claude Code with a Cloudflare API token | Needs Cloudflare access |
| Change nameservers at Spaceship (Step 3) | **Lincoln only** | Registrar login; the irreversible-ish step |
| Verify site + email after (Step 4) | Claude Code | read-only checks |
| Build the auto-subdomain adapter | Claude Code | after token + zone are live |

**Bottom line for Lincoln:** the only thing that *must* be you is the nameserver
change at Spaceship (and a Cloudflare login to add the zone, unless you hand me a
scoped token). The website and email do not move and should not blink. Once DNS is
on Cloudflare and I have a `Zone.DNS:Edit` token, subdomains become automatic.

---

*Prepared 2026-07-04. DNS inventory captured read-only; no DNS changes made. Docs only.*
