## Shared rules for every agent — read before anything else

Claude Code, Codex, Cursor, Copilot, Grok, Gemini and any other agent working in this repo.
These load automatically at the start of every session, so they apply before any other doc is read.

1. **THE ONE RULE: build from what already exists.** First find what's already built and move forward
   from it. Improve what's there; never recreate it. Build new only when nothing covers the need. This
   binds planning as much as building: no one proposes a fresh path before checking the existing one.
2. **Read before you change or claim.** Open and read every file you are about to edit, in this session.
   Never describe a file, repo, setting or doc you have not opened; say "not checked" instead. A guess
   with a disclaimer is still a guess.
3. **Check the Module Catalog before building any capability.** `lincolnnunnally/AppEngine` →
   `source-of-truth/module-catalog.md`. If a block covers it, reuse that block.
4. **Fit the task into the whole; never reshape the whole around the task.** Change only what the task
   needs. Do not rename, restructure, restyle or rewrite working code, copy or design outside it. If the
   task seems to need that, stop and say why in the PR instead of doing it.
5. **Say how it fits.** Every PR description names what existing code or module it builds on and what it
   deliberately left unchanged.
6. **Mission, doctrine and product direction are Lincoln's.** Take them from
   `lincolnnunnally/life-produces-life-source-of-truth`; never invent or change them.

This block is synced from `lincolnnunnally/AppEngine` `source-of-truth/shared-agent-rules.md`.
Edit it there, then run `npm run agent-rules:sync -- <repo dir>`; edits made here are overwritten.
