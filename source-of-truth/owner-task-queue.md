# Owner Task Queue — asks of Lincoln go on the dashboard, not only in chat

**Owner request, 2026-11-01:** agents kept burying the things only Lincoln can
do inside long chat replies. He scrolled back to find them, and some were
missed. From now on, **every ask of Lincoln goes on his to-do list** at
`https://dashboard.unitedundergod.org/tasks`. The chat reply still mentions it,
in one line, with the task id.

## What belongs on the list

Only what the authority model (2026-07-09) reserves for Lincoln:

| kind | examples |
|---|---|
| `money` | approve a paid plan, buy a domain, pay an invoice |
| `credential` | create an API key at a provider, make an OAuth app, log in to a registrar |
| `decision` | mission / doctrine / product direction: what an app IS |
| `account` | an account only he can open (Stripe, Google, Apple, bank) |
| `other` | any hand step an agent truly cannot do itself |

Technical work (code, deploys, env vars from the vault, DNS with a token, DB
changes) is **not** an ask. Do it yourself.

A key that already has a slot in `src/lib/engine/ecosystem-credential-registry.ts`
with an `attention` block shows up on `/tasks` automatically under "Keys only you
can create". Don't add a duplicate task for it.

## How to add one (pick whichever works from where you are)

1. **The file (always works, any repo, any session).** Add an entry to
   `source-of-truth/owner-tasks.json` in the AppEngine repo and merge it to
   `main`. The dashboard picks it up on the next deploy.

   ```bash
   node scripts/owner-task.mjs add --app churchconnect \
     --title "Create a Stripe restricted key for ChurchConnect giving" \
     --why "Online giving stays off until it exists." \
     --step "Stripe → Developers → API keys → Create restricted key" \
     --step "Paste it on the dashboard Keys page under ChurchConnect" \
     --kind credential --priority blocker \
     --link https://dashboard.stripe.com/apikeys \
     --by "Claude (ChurchConnect session)" --source "ChurchConnect PR #123"
   npm run tasks:check
   ```

   From another repo without AppEngine checked out, edit the same file with the
   GitHub tools (one entry, same shape as the ones already in it).

2. **The API (instant).** If you hold `APP_ENGINE_TASKS_TOKEN`:

   ```bash
   APP_ENGINE_TASKS_TOKEN=... node scripts/owner-task.mjs post --app operate --title "..." ...
   # or: POST https://dashboard.unitedundergod.org/api/engine/owner-tasks
   #     Authorization: Bearer $APP_ENGINE_TASKS_TOKEN
   #     { "app": "...", "title": "...", "why": "...", "steps": [...], "kind": "...", "priority": "...", "link": "..." }
   ```

   A brand-new `blocker` posted this way also emails `APP_ENGINE_OWNER_EMAIL`.

## Accuracy gate: check it against the real thing first (owner request, 2026-11-06)

Lincoln, 2026-11-06: several asks on his list were wrong, and one "would've actually been very problematic,
but I just happen to catch." He acts on these. An ask that is wrong is worse than no ask.

Before an ask goes on the list, the agent confirms each of these **live, today**, not from memory, an old
doc or another agent's handoff:

1. **It is still needed.** The key, setting, record or page really is missing or wrong right now (read the
   Vercel env names, the database row, the live page, the provider's API). A doc saying "open" is not proof.
2. **No agent can do it.** You tried the vault, the token, the API, the MCP connector. Only money, a
   credential only he can create, an account only he can open, or a decision belongs here.
3. **Every step is possible exactly as written.** Click through it in your head against the real UI.
   Known traps:
   - Vercel **Sensitive** env vars can't be revealed or copied, not even by Lincoln. Ask him to *create a
     new* key at the provider instead (the WP Easy Peazy ask, #488).
   - Never tell him to copy secrets between places agents can reach. Agents push from the vault.
   - DNS: check what the records point at before asking him to touch them (toner-management.com, #486).
4. **No step can break something live.** Revoking a key, deleting, DNS and payment changes come in the safe
   order: new thing first, verify, *then* remove the old. Say so in the steps.
5. **The link opens the exact page step 1 needs**, not a home page. Open it to confirm.

Record what you checked with `--verified-how "<what you looked at>"` (the CLI refuses an ask without it).
The card shows Lincoln "✓ Double-checked <date>: <how>". Asks with no check, or older than 14 days, show
him a warning. Re-check open asks you touch with `node scripts/owner-task.mjs verify <id> --how "..."`.

**When he marks one "This is wrong"** it leaves his list at once, with his reason in the note
(`GET /api/engine/owner-tasks?all=1`, status `wrong`). Fix the ask (or close it), re-check it, run
`verify`, and merge. It returns to his list only after that re-check lands.

## Writing a good ask

- **title**: the action, in plain words. "Create the X key", not "X key status".
- **why**: what stays blocked until it's done. One sentence.
- **steps**: the exact clicks. He should not have to look anything up.
- **link**: where to do it: the provider page, or a dashboard path like
  `/integrations`. Prefer a page where doing it here sends it to the right place.
- **app**: a slug from `src/lib/engine/app-ops-catalog.ts`, or `ecosystem`.
- **id**: optional. Without one it's derived from app + title. Re-posting the
  same id updates the wording; it never creates a duplicate.

## Before you ask: check he hasn't already answered

Lincoln has had to repeat decisions because answers given in chat were never
written down, so the next agent asked again. Before adding a `decision` or
`money` ask:

1. Search the source of truth: LPL `_SOURCE_OF_TRUTH/` (especially `03_APP_ENGINE`
   §7 and §9a, `01_ECOSYSTEM_MAP`, `CURRENT_FOCUS`), AppEngine
   `source-of-truth/ecosystem-owner-rulings.md`, and the app's own docs.
2. Check closed tasks and their notes: `GET /api/engine/owner-tasks?all=1`.
3. Ask only the part that is genuinely open. Name what is already decided in
   `why` so he can see you looked, e.g. "Build price is set ($25 core…); only
   the hosting fee is open."

**When he answers anything, in chat or in a note, write it down the same day**,
with the date and his words, in the source-of-truth file that owns that topic.
Then close the task. An answer that lives only in a chat is lost.

## Closing the loop

- Lincoln clicks **Done**, **Started, waiting on someone**, or **Not doing this**,
  and can leave a note. His answer to a `decision` lives in that note. Read it
  (`GET /api/engine/owner-tasks?all=1` as the owner, or ask him) before you
  re-ask anything.
- His clicks live in the `owner_tasks` table. Re-syncing the file **never
  reopens** a task he closed.
- When you verify he finished something (the key now exists, the plan is paid),
  close it: `node scripts/owner-task.mjs done <id>` in the file, or
  `PATCH /api/engine/owner-tasks {"id":"...","status":"done"}` with the token.
  A token can only mark tasks done; it can't edit or reopen them.
- When an ask is no longer needed, delete it from the file **and** say so in
  your PR. If he already saw it, close it with `done` instead, so it doesn't
  silently vanish.

## Where it shows

- `/tasks`: the full list. Filter by app, see what was cleared in the last 30 days, add his own.
- Desk home (`/`): "Your to-do" panel at the very top, top five, blockers first.
- App dossier (`/apps/<slug>`): "Only you can do these" for that app, plus a To do button.
- The business table's attention count includes open tasks.

## Cloudflare DNS from a Claude cloud session (2026-11-10)

Lincoln saved a Cloudflare API token on his Default cloud environment, for the host `api.cloudflare.com`. Every
cloud session on that environment can call the Cloudflare API directly; the network proxy adds the token, so send
`Authorization: Bearer proxy-injected` and never ask him for a token or a DNS record again. Checked on
2026-11-10: the token lists 19 zones, including we-succeed.org, vidalia.pro, backoffice.works, unitedundergod.org
and churchconnect.cloud, and it created a CNAME on we-succeed.org. Look at where a record points before changing
it, and add the new record before removing an old one.
