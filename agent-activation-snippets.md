# Paste-ready snippets — turn on the check-out board + start Step 3

Two parts. **Part A** goes ONCE into each agent's instruction box (permanent rule).
**Part B** is what you SEND NOW to start the agents working the board.

---

## PART A — Activation (paste into the instruction box, set once)

### → Claude Code, Codex, and ChatGPT (the building agents)
```
Before any build task: pull the latest BUILD-LEDGER.md from the repo. The repo copy is the ONLY real board — the copy in this box is a stale snapshot, never claim against it. Pick the first 🟢 AVAILABLE item that has no unmet dependency. Change it to 🟡 CLAIMED with your name, date/time, and branch, and commit that ledger change BY ITSELF, FIRST, before doing any work. If your push conflicts on the ledger, someone claimed it a beat before you — pull again and take the next 🟢. Never work an item already 🟡 CLAIMED or 🔵 IN REVIEW. When finished, set the item 🔵 (PR open) or ✅ (merged) with the PR number and commit. Never start a ⛔ BLOCKED item. Obey CURRENT_SCOPE.md and THE ONE RULE: build on what exists, never recreate it.
```

### → Claude chat (strategy/architecture lane — does NOT build)
```
You do not claim or execute build items. Broad chat prepares inputs, reviews architecture, and surfaces/stops out-of-scope requests — build work runs through Claude Code, Codex, and ChatGPT on the board. When build work comes up, point it to the next 🟢 item in BUILD-LEDGER.md (repo copy) rather than starting it here. Obey CURRENT_SCOPE.md.
```

---

## PART B — Dispatch (send this NOW to each building agent to start Step 3)

Same message works for all three — the board lets each one self-pick a different green item, so they won't collide.
```
Step 3 is live on the board. Pull BUILD-LEDGER.md from the repo and follow the check-out protocol: claim the first 🟢 item (3a–3d), then build it ON TOP of the existing AppShell and intake code — find what's already there, judge it, extend it; only replace a piece if it's broken or essential. Open a PR and mark the item 🔵 with the PR number. Then claim the next 🟢 item if one is free.

Step-3 acceptance (all must hold): no route renders bare (every screen inside the AppShell with rail + header); no screen ships a competing theme (palette #0e1512 / gold #e6a93a / teal #34c0ad / text #eef2ee everywhere); every door/intake keeps the rail; exactly TWO doors with one consistent consumer name per intake, no operator jargon.

Stay inside Step 3. Do not start Step 4 — it's blocked until Step 3 is ✅.
```

---

**Order of operations:** paste Part A into all four instruction boxes → commit BUILD-LEDGER.md and CURRENT_SCOPE.md (v8) to the repo so the live board exists → send Part B to Claude Code, Codex, and ChatGPT. They'll claim 3a–3d between them and run in parallel without stepping on each other.
