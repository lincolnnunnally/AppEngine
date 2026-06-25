# AppEngine Intake — SEED (captured material, NOT active)

> **What this is:** holding notes for AppEngine's OWN intake/clarification document —
> the doc the *engine* will reference when a user builds an app, clarifies an opportunity,
> or Lincoln builds out the ecosystem.
>
> **What this is NOT:** this is not part of CURRENT_SCOPE.md and not a build-layer decision.
> CURRENT_SCOPE.md governs *us building AppEngine*. This governs *AppEngine serving users* —
> a different layer, with its own future document set (its own scope, source of truth, intake).
>
> **Status:** parked. AppEngine's documents are its FUTURE OUTPUT, same as its apps.
> They get built when the engine's intake/clarify stage is built (pathway steps 4–5),
> on the existing intake pieces — never recreated, never jumped ahead to.

---

## The six setup questions AppEngine asks before building
Each one prevents a specific way the finished app would disappoint someone.

1. **When this is done and working, walk me through one person using it.**
   Captures the outcome, not a feature list — this is the real spec.
2. **Who is it for?** One sentence. A tool for just you and a tool for the public are different builds.
3. **Do people log in, and does it remember them between visits?**
   Decides whether it needs accounts and stored data — the biggest single fork.
4. **What's the one thing it absolutely has to do?**
   Forces the must-have to the front so the starter nails the core instead of half-doing five things.
5. **Is there anything it must NOT do?**
   The guardrail question (no collecting payments, no emailing people, etc.) — cheap to ask, expensive to discover late.
6. **Where should it live — your own web address, or the link we give you?**
   Defaults to the Vercel hosting URL.

## The reflect-back (said before every build)
> "Here's what I'm going to build: [one plain sentence]. It'll be a real, working first
> version you can log into and try — not the finished polished product yet. After it's live
> I'll walk through every part to confirm it works, then you tell me what to improve. Sound right?"

This catches a wrong direction *before* the build instead of after — where the real safety lives.
