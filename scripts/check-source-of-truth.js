import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const strict = process.env.SOURCE_CHECK_STRICT === "true";
const allowOffline = process.env.SOURCE_CHECK_OFFLINE === "true";
const failures = [];
const warnings = [];
const requiredCoreSourceFiles = [
  "source-of-truth/00-why-we-build.md",
  "source-of-truth/01-ecosystem-philosophy.md",
  "source-of-truth/02-global-principles.md",
  "source-of-truth/03-life-produces-life.md",
  "source-of-truth/04-app-purpose-rules.md",
  "source-of-truth/05-ecosystem-design-gates.md"
];
const requiredCharterSections = [
  {
    label: "purpose",
    patterns: [/^##\s+Purpose\s*$/im]
  },
  {
    label: "audience",
    patterns: [/^##\s+Primary Users?\s*$/im, /^##\s+Audience\s*$/im]
  },
  {
    label: "barrier removed",
    patterns: [/^##\s+Barrier Removed\s*$/im]
  },
  {
    label: "need addressed",
    patterns: [/^##\s+Need Addressed\s*$/im]
  },
  {
    label: "movement toward life",
    patterns: [/^##\s+Movement Toward Life\s*$/im]
  },
  {
    label: "app boundaries",
    patterns: [/^##\s+Boundaries/im, /^##\s+What .+ Should Not Become\s*$/im]
  },
  {
    label: "transformation outcome",
    patterns: [/^##\s+Transformation Outcome\s*$/im]
  },
  {
    label: "tool classification",
    patterns: [/^##\s+Tool Classification\s*$/im]
  }
];

const branch = runGit("branch --show-current");
const head = runGit("rev-parse HEAD");
const localOriginMain = runGit("rev-parse origin/main");
const liveMain = getLiveMainSha();

if (!liveMain && !allowOffline) {
  failures.push("Could not verify live GitHub main. Run with network access or set SOURCE_CHECK_OFFLINE=true only for offline local checks.");
}

if (liveMain && localOriginMain && liveMain !== localOriginMain) {
  failures.push(`Local origin/main is stale. Run git fetch origin main before building. live=${short(liveMain)} local=${short(localOriginMain)}`);
}

if (strict && liveMain && branch === "main" && head !== liveMain) {
  failures.push(`Local main is not at live GitHub main. live=${short(liveMain)} head=${short(head)}`);
} else if (liveMain && branch === "main" && head !== liveMain) {
  warnings.push(`Local main is not at live GitHub main. live=${short(liveMain)} head=${short(head)}. Finish or rebase local work before treating this as current.`);
}

validateManifestFiles();

for (const warning of warnings) {
  console.warn(`source-check warning: ${warning}`);
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`source-check failed: ${failure}`);
  }
  process.exit(1);
}

console.log("source-check ok");

function validateManifestFiles() {
  const manifestPath = path.join(repoRoot, "agents", "manifest.yaml");

  if (!fs.existsSync(manifestPath)) {
    failures.push("agents/manifest.yaml is missing.");
    return;
  }

  const manifest = fs.readFileSync(manifestPath, "utf8");
  const sharedContextFiles = collectListAfterKey(manifest, "shared_context_files");
  const promptFiles = collectPromptFiles(manifest);
  const requiredFiles = [...sharedContextFiles, ...promptFiles];

  validatePhilosophyHierarchy(sharedContextFiles);
  validatePhilosophyFileContent();

  for (const filePath of requiredCoreSourceFiles) {
    if (!sharedContextFiles.includes(filePath)) {
      failures.push(`agents/manifest.yaml must include ${filePath} in shared_context_files.`);
    }
  }

  for (const filePath of requiredFiles) {
    if (!fs.existsSync(path.join(repoRoot, filePath))) {
      failures.push(`Manifest references missing file: ${filePath}`);
    }
  }

  if (!sharedContextFiles.includes("agents/context/source-of-truth.md")) {
    failures.push("agents/manifest.yaml must include agents/context/source-of-truth.md in shared_context_files.");
  }

  validateCharterPhilosophy();
}

function validateCharterPhilosophy() {
  const chartersDir = path.join(repoRoot, "source-of-truth", "charters");

  if (!fs.existsSync(chartersDir)) {
    failures.push("source-of-truth/charters is missing.");
    return;
  }

  const charterFiles = fs
    .readdirSync(chartersDir)
    .filter((fileName) => fileName.endsWith(".md") && fileName !== "template.md")
    .map((fileName) => path.join("source-of-truth", "charters", fileName));

  for (const filePath of charterFiles) {
    const source = fs.readFileSync(path.join(repoRoot, filePath), "utf8");

    for (const section of requiredCharterSections) {
      if (!section.patterns.some((pattern) => pattern.test(source))) {
        failures.push(`Charter ${filePath} is missing required philosophy section: ${section.label}`);
      } else if (!section.patterns.some((pattern) => hasNonEmptySection(source, pattern))) {
        failures.push(`Charter ${filePath} has an empty required philosophy section: ${section.label}`);
      }
    }

    for (const phrase of ["barrier", "need", "life", "transformation"]) {
      if (!new RegExp(phrase, "i").test(source)) {
        failures.push(`Charter ${filePath} does not appear philosophically aligned; missing concept: ${phrase}`);
      }
    }
  }
}

function validatePhilosophyHierarchy(sharedContextFiles) {
  const hierarchy = [
    "source-of-truth/00-why-we-build.md",
    "source-of-truth/01-ecosystem-philosophy.md",
    "source-of-truth/02-global-principles.md",
    "source-of-truth/03-life-produces-life.md",
    "source-of-truth/04-app-purpose-rules.md",
    "source-of-truth/05-ecosystem-design-gates.md"
  ];

  for (const [index, filePath] of hierarchy.entries()) {
    if (sharedContextFiles[index] !== filePath) {
      failures.push(`agents/manifest.yaml must list philosophy hierarchy in order; expected ${filePath} at shared_context_files position ${index + 1}.`);
    }
  }
}

function validatePhilosophyFileContent() {
  const expectations = [
    ["source-of-truth/00-why-we-build.md", ["The apps are not the product", "Transformation is the product", "People are the purpose"]],
    ["source-of-truth/01-ecosystem-philosophy.md", ["God is life", "Acceptance comes before transformation", "Trust unlocks transformation"]],
    ["source-of-truth/02-global-principles.md", ["Optimize for stewardship", "Respect user trust", "Respect user agency"]],
    ["source-of-truth/03-life-produces-life.md", ["Human Journey", "Community Cycle", "Hope -> Action -> Discovery"]],
    ["source-of-truth/04-app-purpose-rules.md", ["Direct Transformation Tools", "Support Tools", "Agents must not force every app into a ministry-style application"]],
    ["source-of-truth/05-ecosystem-design-gates.md", ["What barrier does this remove?", "What need does this address?", "How does this help someone move toward life?"]]
  ];

  for (const [filePath, phrases] of expectations) {
    const absolutePath = path.join(repoRoot, filePath);
    if (!fs.existsSync(absolutePath)) {
      failures.push(`Required philosophy file is missing: ${filePath}`);
      continue;
    }

    const source = fs.readFileSync(absolutePath, "utf8");

    for (const phrase of phrases) {
      if (!source.includes(phrase)) {
        failures.push(`Required philosophy file ${filePath} is missing expected phrase: ${phrase}`);
      }
    }
  }
}

function collectListAfterKey(source, key) {
  const lines = source.split(/\r?\n/);
  const values = [];
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith(`${key}:`)) {
      inSection = true;
      continue;
    }

    if (inSection && /^[a-zA-Z_]+:/.test(line)) break;

    if (inSection) {
      const match = line.match(/^  -\s*(.+)$/);
      if (match) values.push(match[1].trim());
    }
  }

  return values;
}

function hasNonEmptySection(source, headingPattern) {
  const match = headingPattern.exec(source);
  if (!match || typeof match.index !== "number") return false;

  const sectionStart = match.index + match[0].length;
  const rest = source.slice(sectionStart);
  const nextHeading = rest.search(/\n##\s+/);
  const section = nextHeading >= 0 ? rest.slice(0, nextHeading) : rest;

  return section.trim().length > 0;
}

function collectPromptFiles(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.match(/^    prompt:\s*(.+)$/)?.[1]?.trim())
    .filter(Boolean);
}

function getLiveMainSha() {
  const result = runGit("ls-remote origin refs/heads/main");
  if (!result || result === "unavailable") return "";
  return result.split(/\s+/)[0] || "";
}

function runGit(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "unavailable";
  }
}

function short(value) {
  return value ? value.slice(0, 7) : "unknown";
}
