#!/usr/bin/env node
// Owner to-do list helper for agents. See source-of-truth/owner-task-queue.md.
//
//   node scripts/owner-task.mjs check
//       Validate source-of-truth/owner-tasks.json (CI + before any PR that edits it).
//
//   node scripts/owner-task.mjs add --app churchconnect --title "Create the X key" \
//       --why "Y stays off until then" --step "Open ..." --step "Paste ..." \
//       --kind credential --priority blocker --link https://... --by "Claude (ChurchConnect session)" \
//       --source "ChurchConnect PR #123"
//       Append (or update, same id) an ask in the file. Commit it with your PR.
//
//       Requires --verified-how "<what you checked, live>" (accuracy gate, 2026-11-06).
//
//   node scripts/owner-task.mjs verify <id> --how "<what you checked>"
//       Stamp an ask as re-checked today. A task Lincoln marked wrong comes back
//       to his list only after this (and the fix) lands.
//
//   node scripts/owner-task.mjs done <id>
//       Mark an ask done in the file after you VERIFIED the owner finished it.
//
//   node scripts/owner-task.mjs post <same flags as add>
//       POST straight to the live dashboard. Needs APP_ENGINE_TASKS_TOKEN
//       (optional APP_ENGINE_DASHBOARD_URL, default https://dashboard.unitedundergod.org).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { needsCheck, normalizeTaskInput, parseTaskFile, VERIFIED_FRESH_DAYS } from "../src/lib/engine/owner-tasks-core.ts";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "source-of-truth", "owner-tasks.json");

function readFile() {
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function writeFile(data) {
  fs.writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);
}

function flags(argv) {
  const out = { steps: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith("--")) continue;
    index += 1;
    const name = key.slice(2);
    if (name === "step") out.steps.push(value);
    else if (name === "by") out.requestedBy = value;
    else if (name === "verified-how" || name === "how") out.verifiedHow = value;
    else if (name === "verified-on") out.verifiedOn = value;
    else out[name] = value;
  }
  return out;
}

const today = () => new Date().toISOString().slice(0, 10);

// Lincoln, 2026-11-06: asks on his list were wrong, and one would have done real
// harm. Nothing goes on the list unless the agent checked it against the real
// thing first. See source-of-truth/owner-task-queue.md, "Accuracy gate".
// Lincoln, 2026-11-10: "I pressed the open GitHub button and it took me to a 404." He reads the list on his phone
// and is not signed in to GitHub there, so a pull request, a file or a folder in a repository does not open for
// him. A link must open something he can read or act on with no GitHub sign-in: a live page, a preview, or the
// service's own page. GitHub's own account pages (github.com/new, /settings, /apps) are still allowed.
const UNREADABLE_LINK = `Refused: the link is a GitHub pull request, file, folder or repository, which Lincoln cannot open
(private repositories answer 404 on his phone). Link to a page he can read: a live or preview URL, or publish the
document as a page. If there is nothing to open, leave --link out and put what he needs in the steps.`;

export function unreadableLink(link) {
  if (!link) return false;
  let url;
  try {
    url = new URL(link);
  } catch {
    return false;
  }
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return false;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return false; // github.com, github.com/new
  return !["settings", "apps", "organizations", "new", "login"].includes(parts[0]);
}

const ACCURACY_GATE = `Refused: say what you checked. Add --verified-how "<what you looked at, live>".
Before asking Lincoln, confirm against the real thing, not memory or a doc:
  - it is still needed (the setting / key / page really is missing today)
  - no agent can do it (you tried the token, vault, API or connector)
  - every step is possible as written (e.g. Vercel Sensitive vars cannot be shown or copied)
  - no step can break something live; risky steps come in the safe order
  - the link opens the exact page the first step needs
Full rules: source-of-truth/owner-task-queue.md`;

function withVerification(input) {
  if (!input.verifiedHow || input.verifiedHow.trim().length < 12) fail(ACCURACY_GATE);
  if (unreadableLink(input.link)) fail(UNREADABLE_LINK);
  return { ...input, verifiedOn: input.verifiedOn || today() };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [command, ...rest] = process.argv.slice(2);

if (command === "check") {
  const { tasks, errors } = parseTaskFile(readFile());
  if (errors.length) fail(`owner-tasks.json has ${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
  console.log(`owner-tasks.json OK — ${tasks.length} task(s), ${tasks.filter((task) => task.status === "open").length} open.`);
  const stale = tasks.filter((task) => (task.status === "open" || task.status === "waiting") && needsCheck(task, new Date()));
  if (stale.length) {
    console.log(`${stale.length} open ask(s) not double-checked in the last ${VERIFIED_FRESH_DAYS} days (shown to Lincoln with a warning):`);
    for (const task of stale) console.log(`  - ${task.id}${task.verifiedOn ? ` (last ${task.verifiedOn})` : ""}`);
    console.log('Re-check one, then: node scripts/owner-task.mjs verify <id> --how "<what you checked>"');
  }
} else if (command === "verify") {
  const id = rest[0];
  const { verifiedHow } = flags(rest.slice(1));
  if (!id || !verifiedHow || verifiedHow.trim().length < 12) fail('Usage: owner-task.mjs verify <id> --how "<what you checked, live>"');
  const data = readFile();
  const task = data.tasks.find((entry) => entry.id === id);
  if (!task) fail(`No task "${id}" in the file.`);
  task.verifiedOn = today();
  task.verifiedHow = verifiedHow.trim();
  writeFile(data);
  console.log(`Re-checked "${id}" (${task.verifiedOn}). Commit the file. If Lincoln had marked it wrong, it returns to his list.`);
} else if (command === "add") {
  const parsed = normalizeTaskInput(withVerification(flags(rest)));
  if (!parsed.ok) fail(parsed.message);
  const data = readFile();
  const index = data.tasks.findIndex((task) => (task.id || "") === parsed.task.id);
  const entry = { ...parsed.task, app: parsed.task.appSlug, addedOn: new Date().toISOString().slice(0, 10) };
  delete entry.appSlug;
  if (index >= 0) data.tasks[index] = { ...data.tasks[index], ...entry, addedOn: data.tasks[index].addedOn || entry.addedOn };
  else data.tasks.push(entry);
  writeFile(data);
  console.log(`${index >= 0 ? "Updated" : "Added"} "${parsed.task.id}". Commit source-of-truth/owner-tasks.json with your PR.`);
} else if (command === "done") {
  const id = rest[0];
  if (!id) fail("Usage: owner-task.mjs done <id>");
  const data = readFile();
  const task = data.tasks.find((entry) => entry.id === id);
  if (!task) fail(`No task "${id}" in the file.`);
  task.status = "done";
  writeFile(data);
  console.log(`Marked "${id}" done. Commit the file; the dashboard closes it on the next deploy.`);
} else if (command === "post") {
  const token = (process.env.APP_ENGINE_TASKS_TOKEN || "").trim();
  if (!token) fail("APP_ENGINE_TASKS_TOKEN is not set. Use `add` and commit the file instead.");
  const parsed = normalizeTaskInput(withVerification(flags(rest)));
  if (!parsed.ok) fail(parsed.message);
  const base = (process.env.APP_ENGINE_DASHBOARD_URL || "https://dashboard.unitedundergod.org").replace(/\/$/, "");
  const response = await fetch(`${base}/api/engine/owner-tasks`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...parsed.task, app: parsed.task.appSlug })
  });
  const body = await response.text();
  if (!response.ok) fail(`Dashboard said ${response.status}: ${body}`);
  console.log(body);
} else {
  fail("Commands: check | add | verify <id> --how \"...\" | done <id> | post   (see the header of scripts/owner-task.mjs)");
}
