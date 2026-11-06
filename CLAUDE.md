# CLAUDE.md

## Asks of Lincoln go on his to-do list (owner request, 2026-11-01; reaffirmed 2026-11-04)

Anything only Lincoln can do goes on his to-do list at
https://dashboard.unitedundergod.org/tasks, **not only in your chat reply**. Chat asks get buried. That
means money, a credential only he can create, an account only he can open, a mission or product
decision, or a hand step no agent can do.

0. **Check it first.** Confirm against the real thing, today, that the ask is still needed, that no agent
   can do it, that every step is possible as written (Vercel Sensitive vars can't be shown), that no step can
   break something live, and that the link opens the right page. Lincoln caught a harmful ask on 2026-11-06.
   The CLI refuses an ask without `--verified-how "<what you checked>"`. See "Accuracy gate" in the queue doc.
1. **Add it.** The list lives in `source-of-truth/owner-tasks.json` in the AppEngine repo
   (`lincolnnunnally/AppEngine`; attach it with `add_repo` if this session doesn't have it):
   `node scripts/owner-task.mjs add --app <slug> --title "..." --why "..." --step "..." --kind <money|credential|decision|account|other> --priority <blocker|recommended|optional> --link <url> --by "<you>" --source "<repo PR>" --verified-how "<what you checked, live>"`,
   then `node scripts/owner-task.mjs check`, then open a PR and merge it to `main`. If you hold
   `APP_ENGINE_TASKS_TOKEN`, you can instead POST it to `/api/engine/owner-tasks` (instant).
2. **Say it once.** In chat, name the ask in one line with its task id.
3. **Check before you finish.** Before ending any reply that asks Lincoln for something, make sure
   every ask in it has a task id on the list.
4. **Close the loop.** When you verify he finished it, mark it done
   (`node scripts/owner-task.mjs done <id>`).

Full rules: AppEngine `source-of-truth/owner-task-queue.md`.
