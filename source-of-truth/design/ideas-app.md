# Ideas — capture-to-content engine

> Lincoln's spec, 2026-07-04. This app is DISTINCT from Opportunity (which connects
> people to solve problems). Ideas turns Lincoln's scattered notes into content and,
> eventually, into books, sermon series, and speaking tours. On shared LPL infra.

## The problem it solves

Lincoln has a constant stream of ideas. Today they scatter across ClickUp, Evernote,
Apple Notes, GoodNotes, journals — and then collect dust. Nothing happens with them.
The technology now exists to turn an idea into something that helps people: a website
post, a blog, a book chapter, a sermon idea, a new app, an improvement to an existing
app, a message he needs to send someone. Ideas gives every thought one home and a path
to becoming real content.

## The core loop

**Capture → Transcribe → Catalog → Generate → Automate → Compile**

1. **Capture (make it effortless — the whole app fails if capture has friction).**
   - **One-press iPhone voice capture** — the headline. An iOS Shortcut (Home-Screen
     or Action-Button / Back-Tap) records audio and POSTs it to an authenticated
     capture endpoint. Press, speak, done — the idea is saved before it's lost.
   - In-app quick text + voice capture (web/PWA) as the baseline.
   - Later: import from the places ideas already live — ClickUp, Evernote, Apple
     Notes, GoodNotes exports, journal text. (Import is additive; not slice 1.)
2. **Transcribe.** Voice captures are transcribed to text (OpenAI Whisper / audio API;
   key already in the vault). The audio is kept; the transcript is the working text.
3. **Catalog — the content library.** Every idea becomes a library item: title
   (auto-suggested), the raw text/transcript, tags/themes (auto-suggested + editable),
   status (raw → shaped → published → archived), and links to any content generated
   from it. Easy to browse, search, filter, and manage — this is the "library" Lincoln
   asked for so ideas stop scattering.
4. **Generate.** From one idea, draft content in a chosen form:
   social post · blog/website post · book chapter · sermon idea/outline · a new-app
   idea · an improvement to an existing app · a message to send a specific person ·
   speaking-talk outline. (LLM: Anthropic for drafting; key in the vault.) Every draft
   is saved back to the library, linked to its source idea, and editable — nothing
   auto-publishes without Lincoln.
5. **Automate — the daily spark.** Once a day the app picks one idea from the library
   (freshness/rotation, not just newest) and drafts a post for social or the website
   blog, queued for Lincoln's review. Turns a dormant library into a steady output
   stream with near-zero effort. Free-tier scheduler (no Vercel Pro cron): GitHub
   Actions cron or Supabase `pg_cron` hitting an internal endpoint.
6. **Compile.** Select many library/content items and compile them into a larger work:
   a **book** (chapters), a **preaching/teaching series**, a **speaking tour** outline.
   The library is the raw material; compilation assembles + sequences + drafts
   connective tissue into a volume Lincoln can refine.

## Data model (shared LPL Supabase — per the owner ruling)

- `ideas` — id, owner, title, source_kind (voice|text|import), raw_text, audio_url,
  themes/tags, status, created_at.
- `idea_transcripts` — id, idea_id, text, provider, created_at (voice → text).
- `content_items` — id, idea_id, kind (social|blog|chapter|sermon|app_idea|
  app_improvement|message|talk), draft_text, status (draft|approved|published),
  target (which channel), created_at.
- `compilations` — id, title, kind (book|series|tour), status.
- `compilation_items` — compilation_id, content_item_id (or idea_id), order.
- `daily_picks` — id, idea_id, picked_on, generated_content_item_id (rotation history,
  so the same idea isn't re-picked immediately).
- All RLS-scoped to the owner; one shared LPL identity.

## Tech shape

- App in the **life-produces-life monorepo** (`apps/ideas`, per the D1 ruling), Next.js
  + shared Supabase; auth via the shared LPL identity.
- Keys from the AppEngine key vault (universal): `OPENAI_API_KEY` (transcription),
  `ANTHROPIC_API_KEY` (generation). No new secrets in git.
- iPhone capture = an iOS Shortcut → `POST /api/capture` (bearer/token auth) with audio
  or text. Documented as a one-time setup Lincoln installs on his phone.
- Daily automation = a scheduled hit to `/api/daily-spark` (GitHub Actions cron or
  Supabase pg_cron — both free).

## Build slices (ship one at a time; each is usable on its own)

1. **Capture + Library** — text + voice capture (web PWA + the iOS Shortcut endpoint),
   Whisper transcription, the catalog/library UI (browse/search/tag/status). This alone
   ends the scattering. *Start here.*
2. **Generate** — idea → pick a content form → LLM draft → saved to the library,
   editable. Owner approves; nothing auto-publishes.
3. **Daily spark** — the once-a-day pick + auto-draft into a review queue.
4. **Compile** — assemble library items into a book / series / tour.

## Open choices (defaults chosen; confirm to change)

- **Home:** `life-produces-life/apps/ideas` (monorepo) per D1. *(default)*
- **Automation infra:** GitHub Actions cron (free, in-repo, simplest). *(default)*
- **Publishing targets:** which social channels / blog the daily post drafts for —
  needs Lincoln's list + any channel API keys (into the vault). *(needed for slice 3)*
- **Note-app imports** (ClickUp/Evernote/Apple Notes/GoodNotes): which to support first,
  and whether via export-file upload or API. *(slice-later; not blocking slice 1)*
