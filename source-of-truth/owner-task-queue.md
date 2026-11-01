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

## Writing a good ask

- **title**: the action, in plain words. "Create the X key", not "X key status".
- **why**: what stays blocked until it's done. One sentence.
- **steps**: the exact clicks. He should not have to look anything up.
- **link**: where to do it: the provider page, or a dashboard path like
  `/integrations`. Prefer a page where doing it here sends it to the right place.
- **app**: a slug from `src/lib/engine/app-ops-catalog.ts`, or `ecosystem`.
- **id**: optional. Without one it's derived from app + title. Re-posting the
  same id updates the wording; it never creates a duplicate.

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
