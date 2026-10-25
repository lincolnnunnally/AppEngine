import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// C6 — prove the modules work together, the way a customer gets them.
//
// For each composition (every module alone with the website every app gets,
// every starter pack, and all modules at once) this:
//   1. generates the app exactly as a customer build does (local mode),
//   2. typechecks and production-builds it (`next build`),
//   3. loads its schema + seed through the ENGINE'S real setup path into its own
//      fresh Postgres database,
//   4. runs it (`next start`) against that database — unmodified: its Neon
//      driver is pointed at a local stand-in backed by the real Postgres,
//   5. in a real browser: creates an account on the app's own sign-in page and
//      opens every page as that signed-in owner, failing on any error page,
//      5xx response or server error in the log.
// Module task scenarios (does it complete its job?) run per module from
// scripts/lib/module-tasks.mjs when present.
//
//   PROVE_PG_URL=postgresql://postgres@127.0.0.1:5432/postgres \
//     node --import ./scripts/ts-esm-register.mjs scripts/prove-module-combinations.mjs \
//       [--only=singles|packs|all|slug,slug] [--concurrency=2] [--no-runtime] [--keep]
//
// Writes .app-engine/prove/report.json; exits non-zero if any composition fails.

process.env.APP_ENGINE_LOCAL_MODE = "true";
process.env.NEXT_TELEMETRY_DISABLED = "1";

const root = process.cwd();
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? true];
  })
);
const concurrency = Number(args.concurrency || 2);
const runtime = !args["no-runtime"];
const pgUrl = process.env.PROVE_PG_URL;
if (!pgUrl) {
  console.error("Set PROVE_PG_URL to a Postgres server this run may create databases on.");
  process.exit(2);
}

const work = path.join(root, ".app-engine", "prove");
fs.mkdirSync(work, { recursive: true });

const { startLocalNeon } = await import("./lib/local-neon-http.mjs");
const neon = await startLocalNeon({ postgresUrl: pgUrl });
process.env.LOCAL_NEON_PORT = String(neon.port);
createRequire(import.meta.url)("./lib/neon-fetch-redirect.cjs");
const redirectPreload = path.join(root, "scripts/lib/neon-fetch-redirect.cjs");

const { allModules } = await import("../src/lib/engine/modules/registry.ts");
const { BUSINESS_ARCHETYPES, featuresForArchetype } = await import("../src/lib/engine/pricing/business-archetypes.ts");
const { STANDARD_WEB_MODULE_SLUGS } = await import("../src/lib/engine/pricing/module-pricing.ts");
const { createLocalPlannedProject } = await import("../src/lib/engine/development-store.ts");
const { generateProjectApp } = await import("../src/lib/engine/app-generator.ts");
const { setupGeneratedAppDatabase, buildGeneratedAppDatabaseEnvKeys } = await import("../src/lib/engine/database-setup.ts");
// One scenario file per module: scripts/lib/module-tasks/<slug>.mjs exporting
// `task({ page, base, visitor })` — throws if the module can't do its job.
const moduleTasks = {};
const tasksDir = path.join(root, "scripts/lib/module-tasks");
for (const name of fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir).filter((f) => f.endsWith(".mjs")) : []) {
  const mod = await import(path.join(tasksDir, name));
  if (typeof mod.task === "function") moduleTasks[name.replace(/\.mjs$/, "")] = mod.task;
}

// ---- compositions ------------------------------------------------------------
const web = [...STANDARD_WEB_MODULE_SLUGS];
const optional = allModules().filter((m) => m.tier === "optional").map((m) => m.slug);
const every = [
  ...optional.map((slug) => ({ id: `single-${slug}`, slugs: [...new Set([...web, slug])] })),
  ...BUSINESS_ARCHETYPES.map((arch) => {
    const slugs = new Set(web);
    for (const feature of featuresForArchetype(arch)) feature.moduleSlugs.forEach((slug) => slugs.add(slug));
    return { id: `pack-${arch.id}`, slugs: [...slugs] };
  }),
  { id: "all-modules", slugs: [...optional] }
];
// --only: "singles", "packs", "all", composition ids (single-crm-follow-up,
// pack-church-org), or module slugs to compose as one custom app.
const tokens = String(args.only || "singles,packs,all").split(",").filter(Boolean);
const compositions = [];
const customSlugs = [];
for (const token of tokens) {
  const picked =
    token === "singles" ? every.filter((c) => c.id.startsWith("single-"))
    : token === "packs" ? every.filter((c) => c.id.startsWith("pack-"))
    : token === "all" ? every.filter((c) => c.id === "all-modules")
    : every.filter((c) => c.id === token);
  if (picked.length) compositions.push(...picked);
  else customSlugs.push(token);
}
if (customSlugs.length) compositions.push({ id: `custom-${customSlugs.join("+")}`.slice(0, 80), slugs: [...new Set([...web, ...customSlugs])] });

// ---- shared dependencies (every generated app has the same package.json) ------
function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

// The local project store is one JSON file: everything that writes it (generate,
// database setup) runs one at a time; builds and browser checks stay parallel.
let storeLock = Promise.resolve();
function withStore(fn) {
  const next = storeLock.then(fn);
  storeLock = next.catch(() => {});
  return next;
}
function generate(id, slugs) {
  return withStore(() => generateNow(id, slugs));
}

async function generateNow(id, slugs) {
  const created = await createLocalPlannedProject(
    { idea: `Prove ${id}: a small organization that needs ${slugs.join(", ")}`, name: `Prove ${id}`.slice(0, 60), moduleSlugs: slugs },
    { customerEmail: "owner@example.com", gateClearance: { intakeGateId: `prove:${id}`, clarified: true, priorWork: { passed: true, verdict: "build_new" } } }
  );
  const projectId = created.project.id;
  await generateProjectApp(projectId);
  const gen = path.join(root, ".app-engine", "generated-apps");
  return { projectId, dir: path.join(gen, fs.readdirSync(gen).find((entry) => entry.startsWith(projectId))) };
}

const deps = path.join(work, "_deps");
if (!fs.existsSync(path.join(deps, "node_modules", "next"))) {
  const first = await generate("deps", web);
  fs.rmSync(deps, { recursive: true, force: true });
  fs.mkdirSync(deps, { recursive: true });
  fs.copyFileSync(path.join(first.dir, "package.json"), path.join(deps, "package.json"));
  const install = await run("npm", ["install", "--no-audit", "--no-fund"], { cwd: deps });
  if (install.code !== 0) {
    console.error(install.out.slice(-3000));
    process.exit(1);
  }
}

// ---- one composition ----------------------------------------------------------
let portSeed = Number(process.env.PROVE_PORT_BASE || 4100);
const dbName = (id) => `${process.env.PROVE_DB_PREFIX || "prove_"}${id.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`.slice(0, 60);

async function prove(comp) {
  const result = { id: comp.id, slugs: comp.slugs, steps: {}, problems: [] };
  const fail = (step, detail) => {
    result.steps[step] = "fail";
    result.problems.push({ step, detail: String(detail).slice(0, 4000) });
  };
  const app = path.join(work, comp.id);
  try {
    const generated = await generate(comp.id, comp.slugs);
    fs.rmSync(app, { recursive: true, force: true });
    fs.cpSync(generated.dir, app, { recursive: true });
    execFileSync("cp", ["-al", path.join(deps, "node_modules"), path.join(app, "node_modules")]);
    result.steps.generate = "ok";

    const tsc = await run(path.join(app, "node_modules/.bin/tsc"), ["--noEmit"], { cwd: app });
    if (tsc.code !== 0) return fail("typecheck", tsc.out), result;
    result.steps.typecheck = "ok";

    const build = await run(path.join(app, "node_modules/.bin/next"), ["build"], { cwd: app, env: { ...process.env } });
    if (build.code !== 0) return fail("build", build.out.slice(-4000)), result;
    result.steps.build = "ok";

    // Fresh database, loaded by the engine's own setup (same code a customer build runs).
    const db = dbName(comp.id);
    const admin = new URL(pgUrl);
    execFileSync("psql", [admin.toString(), "-qc", `drop database if exists ${db}`, "-c", `create database ${db}`], { stdio: "pipe" });
    const appDbUrl = `postgresql://app:pw@db.neonlocal.test/${db}`;
    for (const key of buildGeneratedAppDatabaseEnvKeys(generated.projectId, `Prove ${comp.id}`)) process.env[key] = appDbUrl;
    const { setup } = await withStore(() => setupGeneratedAppDatabase(generated.projectId));
    if (setup.status !== "database_ready") return fail("database", setup.details), result;
    result.steps.database = "ok";

    if (!runtime) return result;
    const port = portSeed++;
    const log = [];
    const server = spawn(path.join(app, "node_modules/.bin/next"), ["start", "-p", String(port)], {
      cwd: app,
      env: {
        ...process.env,
        DATABASE_URL: appDbUrl,
        AUTH_SECRET: "prove-only-secret",
        AUTH_TRUST_HOST: "true",
        AUTH_URL: `http://localhost:${port}`,
        APP_ENGINE_OWNER_EMAIL: "owner@example.com",
        LOCAL_NEON_PORT: String(neon.port),
        NODE_OPTIONS: `--require ${redirectPreload}`
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    server.stdout.on("data", (d) => log.push(String(d)));
    server.stderr.on("data", (d) => log.push(String(d)));
    try {
      await waitFor(`http://localhost:${port}/`, 30000);
      const browserResult = await browserChecks(app, port, comp);
      result.steps.runtime = browserResult.problems.length ? "fail" : "ok";
      result.pages = browserResult.pages;
      result.tasks = browserResult.tasks;
      for (const problem of browserResult.problems) result.problems.push({ step: "runtime", detail: problem });
      const serverErrors = log.join("").split("\n").filter((line) => /⨯|Error:|TypeError|ReferenceError|relation .* does not exist|column .* does not exist/.test(line));
      if (serverErrors.length) {
        result.steps.runtime = "fail";
        result.problems.push({ step: "server-log", detail: serverErrors.slice(0, 20).join("\n") });
      }
    } finally {
      server.kill("SIGTERM");
    }
    if (!args.keep) fs.rmSync(app, { recursive: true, force: true });
  } catch (error) {
    fail("harness", error?.stack || error);
  }
  return result;
}

async function waitFor(url, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server never answered ${url}`);
}

function pageRoutes(app) {
  const manifest = JSON.parse(fs.readFileSync(path.join(app, ".next/app-path-routes-manifest.json"), "utf8"));
  return [...new Set(Object.values(manifest))]
    .filter((route) => !route.startsWith("/api") && !route.startsWith("/_") && !route.includes("[") && !/\.(png|svg|ico|txt|xml)$|opengraph-image|icon|robots|sitemap/.test(route))
    .sort();
}

let chromiumPromise = null;
async function browserChecks(app, port, comp) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  chromiumPromise ??= chromium.launch();
  const browser = await chromiumPromise;
  const context = await browser.newContext();
  const page = await context.newPage();
  const base = `http://localhost:${port}`;
  const problems = [];
  const pages = {};
  const tasks = {};
  const responses5xx = [];
  page.on("response", (res) => {
    if (res.status() >= 500) responses5xx.push(`${res.status()} ${res.url()}`);
  });
  try {
    // Create the owner account on the app's own sign-in page.
    await page.goto(`${base}/sign-in`);
    await page.fill('input[name="email"]', "owner@example.com");
    await page.fill('input[name="password"]', "prove-password-123");
    await Promise.all([page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 20000 }), page.click('button[value="register"]')]);
    const whoami = await page.goto(`${base}/app`);
    if (!whoami || whoami.status() >= 400 || new URL(page.url()).pathname.startsWith("/sign-in")) {
      problems.push("sign-up did not produce a signed-in session");
      return { problems, pages, tasks };
    }
    pages["(sign-up)"] = "ok";

    for (const route of pageRoutes(app)) {
      const before = responses5xx.length;
      const res = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" }).catch((error) => ({ status: () => 0, error }));
      const status = res.status();
      const body = (await page.content().catch(() => "")).slice(0, 200000);
      const bad =
        status >= 500 ||
        status === 0 ||
        /Application error|Internal Server Error|Unhandled Runtime Error|This page couldn.t load/i.test(body) ||
        responses5xx.length > before;
      pages[route] = bad ? `fail ${status}` : `ok ${status}`;
      if (bad) problems.push(`${route} → ${status}${responses5xx.length > before ? ` (${responses5xx.slice(before).join(", ")})` : ""}`);
    }

    // A signed-out visitor (public pages) and, on demand, signed-in members —
    // separate people from the owner, for the side of a module customers use.
    const visitorContext = await browser.newContext();
    const visitor = await visitorContext.newPage();
    const memberContexts = [];
    let memberCount = 0;
    const newMember = async () => {
      const ctx = await browser.newContext();
      memberContexts.push(ctx);
      const member = await ctx.newPage();
      const email = `member${++memberCount}@example.com`;
      await member.goto(`${base}/sign-in`);
      await member.fill('input[name="email"]', email);
      await member.fill('input[name="password"]', "prove-password-123");
      await Promise.all([member.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 20000 }), member.click('button[value="register"]')]);
      return Object.assign(member, { email });
    };
    for (const slug of comp.slugs) {
      const task = moduleTasks[slug];
      if (!task) continue;
      try {
        await task({ page, base, visitor, newMember });
        tasks[slug] = "ok";
      } catch (error) {
        tasks[slug] = "fail";
        problems.push(`task ${slug}: ${String(error?.message || error).split("\n")[0]}`);
      }
    }
    await visitorContext.close();
    for (const ctx of memberContexts) await ctx.close();
  } finally {
    await context.close();
  }
  return { problems, pages, tasks };
}

// ---- run ---------------------------------------------------------------------
const results = [];
const queue = [...compositions];
console.log(`proving ${compositions.length} compositions (concurrency ${concurrency}, runtime ${runtime ? "on" : "off"})`);
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const comp = queue.shift();
      const started = Date.now();
      const result = await prove(comp);
      result.seconds = Math.round((Date.now() - started) / 1000);
      results.push(result);
      const ok = !result.problems.length;
      console.log(`${ok ? "ok" : "not ok"} - ${comp.id} (${result.seconds}s)${ok ? "" : `: ${result.problems.map((p) => `${p.step}: ${p.detail.split("\n")[0]}`).join(" | ")}`}`);
    }
  })
);
if (chromiumPromise) await (await chromiumPromise).close();
await neon.close();

fs.writeFileSync(path.join(work, "report.json"), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
const failed = results.filter((r) => r.problems.length);
console.log(`\n${results.length - failed.length}/${results.length} compositions proven; report: .app-engine/prove/report.json`);
process.exit(failed.length ? 1 : 0);
