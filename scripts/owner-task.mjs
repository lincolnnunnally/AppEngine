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
//   node scripts/owner-task.mjs done <id>
//       Mark an ask done in the file after you VERIFIED the owner finished it.
//
//   node scripts/owner-task.mjs post <same flags as add>
//       POST straight to the live dashboard. Needs APP_ENGINE_TASKS_TOKEN
//       (optional APP_ENGINE_DASHBOARD_URL, default https://dashboard.unitedundergod.org).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTaskInput, parseTaskFile } from "../src/lib/engine/owner-tasks-core.ts";

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
    else out[name] = value;
  }
  return out;
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
} else if (command === "add") {
  const parsed = normalizeTaskInput(flags(rest));
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
  const parsed = normalizeTaskInput(flags(rest));
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
  fail("Commands: check | add | done <id> | post   (see the header of scripts/owner-task.mjs)");
}
