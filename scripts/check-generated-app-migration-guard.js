import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const generatedAppsDir = path.join(repoRoot, "db", "generated-apps");

const guardedEntryPoints = [
  "scripts/setup-database.mjs",
  ".github/workflows/ai-prompt-factory.yml",
  ".github/workflows/orchestration-monitor.yml"
];

const failures = [];
const sqlFiles = listFiles(generatedAppsDir).filter((file) => file.endsWith(".sql"));

for (const file of sqlFiles) {
  const relativePath = toRelative(file);
  const contents = fs.readFileSync(file, "utf8");

  if (!/production/i.test(contents) || !/(do not apply|blocked|local|preview|disposable)/i.test(contents)) {
    failures.push(`${relativePath} must state production/local-preview apply boundaries.`);
  }
}

for (const entryPoint of guardedEntryPoints) {
  const absolutePath = path.join(repoRoot, entryPoint);

  if (!fs.existsSync(absolutePath)) {
    continue;
  }

  const contents = fs.readFileSync(absolutePath, "utf8");

  if (/db\/generated-apps|db\\generated-apps/i.test(contents)) {
    failures.push(`${entryPoint} must not reference db/generated-apps automatically.`);
  }
}

if (sqlFiles.length > 0) {
  const setupPath = path.join(repoRoot, "scripts", "setup-database.mjs");
  const setupContents = fs.existsSync(setupPath) ? fs.readFileSync(setupPath, "utf8") : "";

  if (!setupContents.includes('"db/migrations/001_initial.sql"') || setupContents.includes("generated-apps")) {
    failures.push("scripts/setup-database.mjs must stay limited to engine migrations, not generated-app artifacts.");
  }
}

if (failures.length > 0) {
  console.error("Generated app migration guard failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log(`generated-apps guard ok (${sqlFiles.length} SQL artifact${sqlFiles.length === 1 ? "" : "s"} inert)`);

function listFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function toRelative(file) {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}
