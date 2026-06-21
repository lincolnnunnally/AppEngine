import fs from "node:fs";
import path from "node:path";

// Prior-Work Check gate engine.
//
// Blocking, evidence-validated, cross-repo prior-work detector. Before any
// candidate becomes a build packet, this gate inspects the *target* repo (not
// AppEngine's own files) for surfaces that already deliver the requested
// capability. Rules:
//   - "can't-see-the-repo = block": if the target repo cannot be read, the gate
//     returns blocked_cannot_verify instead of optimistically allowing a build.
//   - "side-door rule": if prior work exists for a capability, proposing a new
//     parallel surface (a side door) is forbidden; the gate forces
//     extend_existing and lists the collisions.
//
// Verdict-to-packet semantics (pinned across the engine and both standards):
//   - extend_existing -> authorizes a vNext/repair packet ONLY
//   - build_new       -> authorizes a new App Build Packet ONLY
//   - anything else / missing verdict -> blocked
//
// The gate is read-only. It never writes to the target repo, never runs
// migrations, never deploys, and never creates paid resources.

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel"
]);

const DEFAULT_FORBIDDEN_SIDE_DOORS = [
  "new CRM or member-management app",
  "new visitor route or table that duplicates an existing capture surface",
  "duplicate admin list parallel to the existing inbox",
  "member portal",
  "multi-church tenancy layer",
  "analytics/automation/duplicate-detection scope not requested by the run"
];

export function runPriorWorkCheck(input, options = {}) {
  const cwd = options.cwd || process.cwd();
  const request = normalizeRequest(input);
  const repo = resolveRepo(request.targetRepo, cwd);

  if (!repo.visible) {
    return blockedArtifact(request, repo);
  }

  const capabilities = request.capabilities.map((cap) => evaluateCapability(cap, repo));

  // Resolve against the canonical app_portfolio_registry (registered apps +
  // completed loop evidence) before recommending build. Fail closed if the
  // registry lookup itself fails (corrupt/unreadable) so an unverifiable
  // registry can never silently authorize a new build.
  const registrySearch = searchPortfolioRegistry(cwd, registryQuery(request));
  if (!registrySearch.available) {
    return registryUnavailableArtifact(request, repo, registrySearch);
  }

  const fsPriorWork = capabilities.some((cap) => cap.priorWorkFound);
  const registryScore = strongestRegistryScore(registrySearch);
  // Filesystem prior work (an existing surface) is an exact signal. Registry
  // matches are exact (slug match or >=2 terms) or partial (single weak term).
  const matchStrength = fsPriorWork ? "exact" : registryScore;

  // exact -> reuse/extend; partial/unclear -> human review; none -> build new.
  const verdict =
    matchStrength === "exact" ? "extend_existing" : matchStrength === "partial" ? "needs_human_review" : "build_new";
  const passed = verdict === "extend_existing" || verdict === "build_new";

  const extensionTargets = fsPriorWork ? buildExtensionTargets(capabilities, repo) : [];
  const sideDoorViolations = fsPriorWork ? buildSideDoorViolations(capabilities, request, extensionTargets) : [];
  const findings = capabilities
    .filter((cap) => cap.tableSplit)
    .map((cap) => ({ kind: "table_split", capabilityId: cap.id, ...cap.tableSplit }));

  const artifact = {
    kind: "prior_work_check",
    schemaVersion: 1,
    blocking: true,
    passed,
    sourceRequest: request.source,
    targetRepo: {
      name: repo.name,
      resolvedPath: repo.resolvedRelative,
      visible: true,
      triedPaths: repo.triedPaths,
      evidenceSources: repo.evidenceSources
    },
    verdict,
    matchStrength,
    capabilities,
    extensionTargets,
    sideDoorViolations,
    findings,
    registrySearch,
    forbiddenSideDoors: request.forbiddenSideDoors,
    decision: {
      verdict,
      proceed: passed,
      authorizesPacket:
        verdict === "extend_existing" ? "vnext_packet" : verdict === "build_new" ? "app_build_packet" : "none",
      nextSafeAction:
        verdict === "extend_existing"
          ? "route_to_vnext_packet_extending_existing_surfaces"
          : verdict === "build_new"
          ? "route_to_app_build_packet_verified_no_prior_work"
          : "route_to_human_review_or_clarification",
      ownerApprovalRequired: true,
      reason: priorWorkReason(verdict, fsPriorWork, registrySearch)
    },
    ownerReadableReport: "",
    followUpTasks: [],
    guardrails: guardrails()
  };

  artifact.ownerReadableReport = renderOwnerReport(artifact);
  artifact.followUpTasks = buildFollowUpTasks(artifact);
  return artifact;
}

function blockedArtifact(request, repo) {
  const artifact = {
    kind: "prior_work_check",
    schemaVersion: 1,
    blocking: true,
    passed: false,
    sourceRequest: request.source,
    targetRepo: {
      name: repo.name,
      resolvedPath: null,
      visible: false,
      triedPaths: repo.triedPaths,
      evidenceSources: repo.evidenceSources
    },
    verdict: "blocked_cannot_verify",
    capabilities: request.capabilities.map((cap) => ({
      id: cap.id,
      description: cap.description,
      priorWorkFound: null,
      evidence: []
    })),
    extensionTargets: [],
    sideDoorViolations: [],
    findings: [],
    forbiddenSideDoors: request.forbiddenSideDoors,
    decision: {
      verdict: "blocked_cannot_verify",
      proceed: false,
      authorizesPacket: "none",
      nextSafeAction: "make_target_repo_visible_then_rerun_prior_work_check",
      ownerApprovalRequired: true,
      reason:
        "The target repo could not be read. Per the can't-see-the-repo rule the gate blocks rather than allowing a build that might duplicate existing work."
    },
    ownerReadableReport: "",
    followUpTasks: [],
    guardrails: guardrails()
  };

  artifact.ownerReadableReport = renderOwnerReport(artifact);
  artifact.followUpTasks = buildFollowUpTasks(artifact);
  return artifact;
}

function resolveRepo(targetRepo, cwd) {
  const triedPaths = [];
  const evidenceSources = [];
  let resolvedPath = null;
  let resolvedRelative = null;

  for (const candidate of targetRepo.candidatePaths) {
    const abs = path.resolve(cwd, candidate);
    triedPaths.push(candidate);
    if (!resolvedPath && isDirectory(abs)) {
      resolvedPath = abs;
      resolvedRelative = candidate;
    }
  }

  if (resolvedPath) {
    evidenceSources.push({ kind: "repo", path: resolvedRelative });
  }

  for (const schemaPath of targetRepo.backupSchemaPaths) {
    const abs = path.resolve(cwd, schemaPath);
    if (isFile(abs)) {
      evidenceSources.push({ kind: "backup_schema", path: schemaPath, absPath: abs });
    }
  }

  return {
    name: targetRepo.name,
    resolvedPath,
    resolvedRelative,
    triedPaths,
    evidenceSources,
    visible: Boolean(resolvedPath)
  };
}

function evaluateCapability(cap, repo) {
  const evidence = [];
  const seenComponents = new Set();

  // Component / file surface evidence — collect EVERY distinct match across
  // hints (do not stop at the first), so split surfaces both appear.
  for (const hint of cap.componentHints) {
    const match = findFileByName(repo.resolvedPath, hint);
    if (!match) continue;
    const rel = relativeToRepo(repo, match);
    if (seenComponents.has(rel)) continue;
    seenComponents.add(rel);
    evidence.push({
      kind: "component",
      path: rel,
      match: hint,
      readsTables: detectTablesInFile(match, cap.tableHints)
    });
  }

  // Route surface evidence.
  for (const hint of cap.routeHints) {
    const match = grepRepoSource(repo.resolvedPath, hint);
    if (match) {
      evidence.push({ kind: "route", path: relativeToRepo(repo, match.file), line: match.line, match: hint });
      break;
    }
  }

  // Table / column evidence from backup schema (and repo source as fallback).
  const schemaSources = repo.evidenceSources.filter((source) => source.kind === "backup_schema");
  for (const hint of cap.tableHints) {
    const schemaHit = grepEvidenceSources(schemaSources, hint);
    const hit = schemaHit || grepRepoSourceHit(repo.resolvedPath, hint);
    if (hit) {
      evidence.push({ kind: "table", path: hit.path, line: hit.line, match: hint, inLiveSchema: Boolean(schemaHit) });
    }
  }
  for (const hint of cap.columnHints) {
    const hit = grepEvidenceSources(schemaSources, hint) || grepRepoSourceHit(repo.resolvedPath, hint);
    if (hit) {
      evidence.push({ kind: "column", path: hit.path, line: hit.line, match: hint });
    }
  }

  const result = {
    id: cap.id,
    description: cap.description,
    priorWorkFound: evidence.length > 0,
    evidence
  };

  const split = detectTableSplit(evidence);
  if (split) result.tableSplit = split;

  return result;
}

function detectTableSplit(evidence) {
  const components = evidence.filter(
    (item) => item.kind === "component" && Array.isArray(item.readsTables) && item.readsTables.length
  );
  const tables = unique(components.flatMap((item) => item.readsTables));
  if (tables.length < 2) return null;

  return {
    tables,
    components: components.map((item) => ({ path: item.path, readsTables: item.readsTables })),
    note: `Admin/data surfaces read different tables (${tables.join(" vs ")}); reconcile to one canonical table in the follow-up migration before extending.`
  };
}

function buildExtensionTargets(capabilities, repo) {
  const targets = [];
  const migrationsDir = repo.resolvedPath ? findDir(repo.resolvedPath, "migrations") : null;

  for (const cap of capabilities) {
    if (!cap.priorWorkFound) continue;

    const components = cap.evidence.filter((item) => item.kind === "component");
    for (const component of components) {
      targets.push({
        capabilityId: cap.id,
        kind: "component",
        path: component.path,
        readsTables: component.readsTables || [],
        action: "extend_component",
        note: `Extend ${component.path} for "${cap.description}"; do not create a parallel component.`
      });
    }

    if (components.length === 0) {
      const tableOrColumn = cap.evidence.find((item) => item.kind === "table" || item.kind === "column");
      if (tableOrColumn) {
        const table = cap.evidence.find((item) => item.kind === "table")?.match || tableOrColumn.match;
        targets.push({
          capabilityId: cap.id,
          kind: "migration",
          path: migrationsDir ? relativeToRepo(repo, migrationsDir) : "supabase/migrations",
          table,
          action: "add_follow_up_migration",
          note: `Reconcile to the existing table via a follow-up migration (${table}); do not create a new table.`
        });
        continue;
      }

      const route = cap.evidence.find((item) => item.kind === "route");
      if (route) {
        targets.push({
          capabilityId: cap.id,
          kind: "route",
          path: route.path,
          action: "extend_route",
          note: `Extend the existing route at ${route.path}; do not add a parallel route.`
        });
      }
    }
  }

  return targets;
}

function buildSideDoorViolations(capabilities, request, extensionTargets) {
  const violations = [];
  const priorById = new Map(capabilities.map((cap) => [cap.id, cap]));
  const firstTargetById = new Map();
  for (const target of extensionTargets) {
    if (!firstTargetById.has(target.capabilityId)) firstTargetById.set(target.capabilityId, target.path);
  }

  for (const proposed of request.proposedNewSurfaces) {
    const cap = priorById.get(proposed.capabilityId);
    if (cap && cap.priorWorkFound) {
      violations.push({
        proposedSurface: `${proposed.kind}:${proposed.name}`,
        capabilityId: proposed.capabilityId,
        collidesWith: firstTargetById.get(proposed.capabilityId) || cap.evidence[0]?.path,
        rule: "side_door_forbidden",
        instruction: "Extend the existing surface instead of creating a parallel one."
      });
    }
  }

  return violations;
}

function renderOwnerReport(artifact) {
  const lines = [
    "Prior-Work Check",
    "",
    `Run: ${artifact.sourceRequest.title} (${artifact.sourceRequest.runId})`,
    `Target repo: ${artifact.targetRepo.name} -> ${artifact.targetRepo.visible ? artifact.targetRepo.resolvedPath : "NOT VISIBLE"}`,
    `Verdict: ${artifact.verdict}`,
    `Authorizes: ${artifact.decision.authorizesPacket}`,
    `Proceed: ${artifact.decision.proceed ? "yes" : "no (blocked)"}`,
    `Why: ${artifact.decision.reason}`
  ];

  if (artifact.verdict === "extend_existing") {
    lines.push("", "Extend these existing surfaces (do not rebuild):");
    for (const target of artifact.extensionTargets) {
      const tables = target.readsTables && target.readsTables.length ? ` [reads ${target.readsTables.join(", ")}]` : "";
      lines.push(`- ${target.capabilityId}: ${target.kind} ${target.path}${target.table ? ` (${target.table})` : ""}${tables}`);
    }
    if (artifact.findings.length) {
      lines.push("", "Findings to fix while extending:");
      for (const finding of artifact.findings) {
        lines.push(`- ${finding.kind} (${finding.capabilityId}): ${finding.note}`);
      }
    }
    if (artifact.sideDoorViolations.length) {
      lines.push("", "Blocked side doors:");
      for (const violation of artifact.sideDoorViolations) {
        lines.push(`- ${violation.proposedSurface} duplicates ${violation.collidesWith}`);
      }
    }
  }

  if (artifact.verdict === "needs_human_review") {
    lines.push("", "Possible prior work (not exact) in app_portfolio_registry:");
    for (const match of artifact.registrySearch.registeredMatches) {
      lines.push(`- ${match.score} match: registered app ${match.slug} (${match.name})`);
    }
    for (const match of artifact.registrySearch.completedLoopMatches) {
      lines.push(`- ${match.score} match: completed loop ${match.runId} on ${match.appSlug}`);
    }
    lines.push("Next: human review/clarification with an explicit reuse-or-build decision before any new App Build Packet.");
  }

  if (artifact.verdict === "blocked_registry_unavailable") {
    lines.push("", `Registry lookup error: ${(artifact.registrySearch.lookupErrors || []).join("; ") || "unreadable store"}`);
    lines.push("Next: fix the app_portfolio_registry lookup, then rerun. Build stays blocked (fail-closed).");
  }

  if (artifact.verdict === "blocked_cannot_verify") {
    lines.push("", `Tried paths: ${artifact.targetRepo.triedPaths.join(", ") || "none"}`);
    lines.push("Next: make the target repo visible (grant read access / correct path), then rerun.");
  }

  lines.push("", "Guardrails: read-only, no migrations executed, no deploy, no paid resources.");
  return lines.join("\n");
}

function buildFollowUpTasks(artifact) {
  if (artifact.verdict === "blocked_cannot_verify") {
    return [
      {
        title: `[${artifact.sourceRequest.runId}] Make ${artifact.targetRepo.name} visible to the Prior-Work Check`,
        recommendedLabel: "ai:plan",
        body: [
          "The Prior-Work Check could not read the target repo, so the build is blocked.",
          "",
          `Tried paths: ${artifact.targetRepo.triedPaths.join(", ") || "none"}`,
          "Provide a readable checkout path or backup evidence, then rerun the gate."
        ].join("\n")
      }
    ];
  }

  if (artifact.verdict === "extend_existing") {
    return [
      {
        title: `[${artifact.sourceRequest.runId}] Extend existing ${artifact.targetRepo.name} surfaces`,
        recommendedLabel: "ai:plan",
        body: [
          `Prior-Work Check verdict: extend_existing for ${artifact.sourceRequest.title}.`,
          "Authorizes a vNext/repair packet only (not a new App Build Packet).",
          "",
          "## Extend (do not rebuild)",
          ...artifact.extensionTargets.map((target) => `- ${target.capabilityId}: ${target.kind} ${target.path} - ${target.note}`),
          "",
          "## Findings",
          ...(artifact.findings.length ? artifact.findings.map((finding) => `- ${finding.note}`) : ["- none"]),
          "",
          "## Forbidden side doors",
          ...artifact.forbiddenSideDoors.map((item) => `- ${item}`)
        ].join("\n")
      }
    ];
  }

  if (artifact.verdict === "needs_human_review") {
    return [
      {
        title: `[${artifact.sourceRequest.runId}] Human review: possible prior work for ${artifact.targetRepo.name}`,
        recommendedLabel: "ai:plan",
        body: [
          `Prior-Work Check verdict: needs_human_review for ${artifact.sourceRequest.title}.`,
          "The registry has a partial (non-exact) match. Make an explicit reuse-or-build decision before any new App Build Packet.",
          "",
          "## Possible prior work",
          ...artifact.registrySearch.registeredMatches.map((match) => `- ${match.score}: ${match.slug} (${match.name})`),
          ...artifact.registrySearch.completedLoopMatches.map((match) => `- ${match.score}: completed loop ${match.runId} on ${match.appSlug}`)
        ].join("\n")
      }
    ];
  }

  if (artifact.verdict === "blocked_registry_unavailable") {
    return [
      {
        title: `[${artifact.sourceRequest.runId}] Fix app_portfolio_registry lookup`,
        recommendedLabel: "ai:plan",
        body: [
          "The Prior-Work Check could not read the canonical app_portfolio_registry, so the build is blocked (fail-closed).",
          "",
          `Lookup error: ${(artifact.registrySearch.lookupErrors || []).join("; ") || "unreadable store"}`,
          "Restore the registry store, then rerun the gate."
        ].join("\n")
      }
    ];
  }

  return [];
}

function guardrails() {
  return {
    blockingGate: true,
    readOnly: true,
    cannotSeeRepoBlocks: true,
    sideDoorForbidden: true,
    evidenceRequired: true,
    crossRepo: true,
    noTargetRepoWrites: true,
    noMigrationsExecuted: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noSecretsOrEnvChanges: true
  };
}

// ---------------------------------------------------------------------------
// Input normalization
// ---------------------------------------------------------------------------

function normalizeRequest(input) {
  const raw = input || {};
  const source = raw.request || raw.source || {};
  const targetRepo = raw.targetRepo || {};

  return {
    source: {
      runId: str(source.runId) || "unknown-run",
      title: str(source.title) || "Untitled run",
      goal: str(source.goal) || ""
    },
    targetRepo: {
      name: str(targetRepo.name) || "unknown-repo",
      candidatePaths: arr(targetRepo.candidatePaths),
      backupSchemaPaths: arr(targetRepo.backupSchemaPaths)
    },
    capabilities: arr(raw.capabilities).map((cap) => ({
      id: str(cap.id),
      description: str(cap.description),
      componentHints: arr(cap.componentHints),
      routeHints: arr(cap.routeHints),
      tableHints: arr(cap.tableHints),
      columnHints: arr(cap.columnHints)
    })),
    proposedNewSurfaces: arr(raw.proposedNewSurfaces).map((surface) => ({
      kind: str(surface.kind) || "surface",
      name: str(surface.name),
      capabilityId: str(surface.capabilityId)
    })),
    forbiddenSideDoors: arr(raw.forbiddenSideDoors).length ? arr(raw.forbiddenSideDoors) : DEFAULT_FORBIDDEN_SIDE_DOORS
  };
}

// ---------------------------------------------------------------------------
// Filesystem evidence helpers (bounded, read-only)
// ---------------------------------------------------------------------------

function findFileByName(root, hint, maxDepth = 8) {
  if (!root) return null;
  const needle = hint.toLowerCase();
  return walk(root, maxDepth, (entryPath, isDir, name) => {
    if (!isDir && name.toLowerCase().includes(needle)) return entryPath;
    return null;
  });
}

function findDir(root, name, maxDepth = 6) {
  if (!root) return null;
  const needle = name.toLowerCase();
  return walk(root, maxDepth, (entryPath, isDir, entryName) => {
    if (isDir && entryName.toLowerCase() === needle) return entryPath;
    return null;
  });
}

function detectTablesInFile(absPath, tableHints) {
  const found = [];
  for (const hint of tableHints) {
    if (grepFile(absPath, hint.toLowerCase())) found.push(hint);
  }
  return found;
}

function grepRepoSource(root, token, maxDepth = 8) {
  const hit = grepRepoSourceHit(root, token, maxDepth);
  return hit ? { file: hit.absPath, line: hit.line } : null;
}

function grepRepoSourceHit(root, token, maxDepth = 8) {
  if (!root) return null;
  const needle = token.toLowerCase();
  const found = walk(root, maxDepth, (entryPath, isDir, name) => {
    if (isDir) return null;
    if (!/\.(ts|tsx|js|jsx|py|sql)$/.test(name)) return null;
    const lineHit = grepFile(entryPath, needle);
    if (lineHit) return { absPath: entryPath, line: lineHit.line };
    return null;
  });
  if (!found) return null;
  return { path: relativeFromCwd(found.absPath), absPath: found.absPath, line: found.line };
}

function grepEvidenceSources(sources, token) {
  const needle = token.toLowerCase();
  for (const source of sources) {
    const lineHit = grepFile(source.absPath, needle);
    if (lineHit) return { path: source.path, line: lineHit.line };
  }
  return null;
}

function walk(root, maxDepth, visit) {
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length) {
    const { dir, depth } = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      const isDir = entry.isDirectory();
      if (isDir && SKIP_DIRS.has(entry.name)) continue;
      const result = visit(entryPath, isDir, entry.name);
      if (result) return result;
      if (isDir && depth < maxDepth) {
        stack.push({ dir: entryPath, depth: depth + 1 });
      }
    }
  }
  return null;
}

function grepFile(absPath, needle) {
  let content;
  try {
    content = fs.readFileSync(absPath, "utf8");
  } catch {
    return null;
  }
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].toLowerCase().includes(needle)) {
      return { line: i + 1 };
    }
  }
  return null;
}

function relativeToRepo(repo, absPath) {
  if (!repo.resolvedPath) return absPath;
  const rel = path.relative(repo.resolvedPath, absPath);
  return rel.split(path.sep).join("/");
}

function relativeFromCwd(absPath) {
  const rel = path.relative(process.cwd(), absPath);
  return rel.split(path.sep).join("/");
}

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

function arr(value) {
  return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null) : [];
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null && String(value).trim() !== "")));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

// ---------------------------------------------------------------------------
// Canonical registry + completed-loop search (app_portfolio_registry)
// ---------------------------------------------------------------------------

function registryQuery(request) {
  const titleTerms = String(request.source.title || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 4);
  const repoTerm = String(request.targetRepo.name || "").toLowerCase();
  const capabilityTerms = request.capabilities.map((cap) => cap.id);
  return {
    slug: slugify(request.targetRepo.name || ""),
    terms: unique([...titleTerms, repoTerm, ...capabilityTerms]).filter((term) => term.length >= 4)
  };
}

function searchPortfolioRegistry(cwd, query) {
  const root = stateRoot(cwd);
  const registry = readStoreFile(path.join(root, "app_portfolio_registry", "registered-apps.json"));
  const loops = readStoreFile(path.join(root, "loop_run_records", "manual-loop-runs.json"));

  // Fail closed: a present-but-unreadable store is a lookup FAILURE, not "empty".
  // An absent store (never written) is a legitimately empty registry.
  const available = registry.status !== "error" && loops.status !== "error";
  const lookupErrors = [];
  if (registry.status === "error") lookupErrors.push(`app_portfolio_registry: ${registry.error}`);
  if (loops.status === "error") lookupErrors.push(`loop_run_records: ${loops.error}`);

  const entries = Array.isArray(registry.data?.entries) ? registry.data.entries : [];
  const loopRecords = Array.isArray(loops.data?.records) ? loops.data.records : [];
  const terms = (query.terms || []).map((term) => term.toLowerCase()).filter(Boolean);
  const slug = query.slug ? String(query.slug).toLowerCase() : "";

  const registeredMatches = [];
  const completedLoopMatches = [];
  for (const entry of entries) {
    const loopGoals = Array.isArray(entry.completedLoops) ? entry.completedLoops.map((loop) => loop.goal).join(" ") : "";
    const score = scoreMatch(slug, entry.slug, `${entry.slug} ${entry.name} ${loopGoals}`, terms);
    if (score === "none") continue;
    registeredMatches.push({ slug: entry.slug, name: entry.name, type: entry.type, completedLoops: (entry.completedLoops || []).length, score });
    for (const loop of entry.completedLoops || []) {
      completedLoopMatches.push({ appSlug: entry.slug, runId: loop.runId, goal: loop.goal, status: loop.status, score });
    }
  }

  const loopRecordMatches = loopRecords
    .filter((record) => matchTermCount(`${record.appIdea} ${record.goal}`, terms) > 0)
    .map((record) => ({ runId: record.runId, goal: record.goal, appIdea: record.appIdea }));

  return { available, lookupErrors, stateRoot: relativeFromCwd(root), registeredMatches, completedLoopMatches, loopRecordMatches };
}

// Confidence scoring: exact = slug equality or >=2 term hits; partial = a single
// weak term hit; none = no signal.
function scoreMatch(querySlug, entrySlug, haystack, terms) {
  if (querySlug && String(entrySlug || "").toLowerCase() === querySlug) return "exact";
  const hits = matchTermCount(haystack, terms);
  if (hits >= 2) return "exact";
  if (hits === 1) return "partial";
  return "none";
}

function matchTermCount(haystack, terms) {
  const value = String(haystack || "").toLowerCase();
  return terms.filter((term) => term.length >= 4 && value.includes(term)).length;
}

function strongestRegistryScore(registrySearch) {
  const scores = [
    ...registrySearch.registeredMatches.map((match) => match.score),
    ...registrySearch.completedLoopMatches.map((match) => match.score)
  ];
  if (scores.includes("exact")) return "exact";
  if (scores.includes("partial")) return "partial";
  return "none";
}

function priorWorkReason(verdict, fsPriorWork, registrySearch) {
  void registrySearch;
  if (verdict === "extend_existing") {
    return fsPriorWork
      ? "Prior work exists in the target repo; extend the existing surfaces with a vNext/repair packet instead of building parallel ones."
      : "Prior work exists in app_portfolio_registry (a registered app or completed loop); extend the existing app/project instead of building new.";
  }
  if (verdict === "needs_human_review") {
    return "Possible prior work was found in app_portfolio_registry but the match is not exact. Route to human review/clarification for an explicit reuse-or-build decision before any new App Build Packet.";
  }
  return "Target repo and app_portfolio_registry were searched (registry available) and no prior work was found; a new App Build Packet is authorized.";
}

function registryUnavailableArtifact(request, repo, registrySearch) {
  const artifact = {
    kind: "prior_work_check",
    schemaVersion: 1,
    blocking: true,
    passed: false,
    sourceRequest: request.source,
    targetRepo: {
      name: repo.name,
      resolvedPath: repo.resolvedRelative,
      visible: true,
      triedPaths: repo.triedPaths,
      evidenceSources: repo.evidenceSources
    },
    verdict: "blocked_registry_unavailable",
    matchStrength: "unknown",
    capabilities: request.capabilities.map((cap) => ({ id: cap.id, description: cap.description, priorWorkFound: null, evidence: [] })),
    extensionTargets: [],
    sideDoorViolations: [],
    findings: [],
    registrySearch,
    forbiddenSideDoors: request.forbiddenSideDoors,
    decision: {
      verdict: "blocked_registry_unavailable",
      proceed: false,
      authorizesPacket: "none",
      nextSafeAction: "fix_registry_lookup_then_rerun_prior_work_check",
      ownerApprovalRequired: true,
      reason: `The app_portfolio_registry lookup failed (${(registrySearch.lookupErrors || []).join("; ") || "unreadable store"}). Per fail-closed policy, no build may proceed until the canonical registry can be read.`
    },
    ownerReadableReport: "",
    followUpTasks: [],
    guardrails: guardrails()
  };
  artifact.ownerReadableReport = renderOwnerReport(artifact);
  artifact.followUpTasks = buildFollowUpTasks(artifact);
  return artifact;
}

function stateRoot(cwd) {
  if (process.env.APPENGINE_STATE_ROOT) return process.env.APPENGINE_STATE_ROOT;
  return path.join(cwd, ".app-engine", "state");
}

function readStoreFile(absPath) {
  let raw;
  try {
    raw = fs.readFileSync(absPath, "utf8");
  } catch (caught) {
    if (caught && caught.code === "ENOENT") return { status: "absent", data: null };
    return { status: "error", data: null, error: caught && caught.message ? caught.message : "unreadable" };
  }
  try {
    return { status: "ok", data: JSON.parse(raw) };
  } catch (caught) {
    return { status: "error", data: null, error: `invalid JSON: ${caught && caught.message ? caught.message : "parse error"}` };
  }
}

// ---------------------------------------------------------------------------
// RUN-001 ChurchConnect Visitor Capture example request
// ---------------------------------------------------------------------------

export function run001ExampleRequest() {
  return {
    request: {
      runId: "run-001-2026-06-21-churchconnect-visitor-capture-cycle-1",
      title: "ChurchConnect Visitor Capture",
      goal: "Mobile public visitor form, stored submissions, owner-only admin list, persistent followed-up state."
    },
    targetRepo: {
      name: "ChurchConnect",
      candidatePaths: [
        "../../ChurchConnect/ChurchConnect",
        "../ChurchConnect/ChurchConnect",
        "../../ChurchConnect",
        "ChurchConnect/ChurchConnect"
      ],
      backupSchemaPaths: [
        ".app-engine/backups/churchconnect-dzxipsskcrvbtvzekbgz-20260619T121137Z/schema-preview-no-owner.sql"
      ]
    },
    capabilities: [
      {
        id: "visitor-capture-form",
        description: "Mobile public visitor capture form (name + email/phone)",
        componentHints: ["VisitorRegistration"],
        tableHints: ["connection_cards", "church_guests"]
      },
      {
        id: "admin-follow-up-list",
        description: "Owner-only admin list of submissions with followed-up state",
        // Both admin surfaces exist and read DIFFERENT tables; the gate must
        // surface that split (the real ChurchConnect bug) rather than letting
        // RUN-001 build a third parallel surface.
        componentHints: ["ConnectionInbox", "ConnectionCards"],
        tableHints: ["connection_cards", "connection_inbox"]
      },
      {
        id: "persistent-follow-up-state",
        description: "Persisted follow-up status that survives reload",
        tableHints: ["connection_cards"],
        columnHints: ["follow_up_status"]
      }
    ],
    proposedNewSurfaces: [
      { kind: "component", name: "NewVisitorCaptureForm", capabilityId: "visitor-capture-form" },
      { kind: "component", name: "VisitorAdminDashboard", capabilityId: "admin-follow-up-list" },
      { kind: "table", name: "visitor_submissions", capabilityId: "persistent-follow-up-state" }
    ]
  };
}

// "Can't see the repo" example: same request pointed at an unreadable path.
export function unreachableRepoExampleRequest() {
  const example = run001ExampleRequest();
  example.targetRepo = {
    name: "ChurchConnect",
    candidatePaths: ["../../does-not-exist/ChurchConnect"],
    backupSchemaPaths: []
  };
  return example;
}

// "Build new" example: a capability with no prior work in a readable repo.
export function buildNewExampleRequest() {
  return {
    request: {
      runId: "example-build-new",
      title: "Brand-new capability with no prior work",
      goal: "Demonstrate verified build_new."
    },
    targetRepo: {
      // A readable directory that contains no code surfaces for the requested
      // capability (markdown run records only), so the gate can verify absence.
      name: "readable-repo-no-prior-work",
      candidatePaths: ["loop-runs"],
      backupSchemaPaths: []
    },
    capabilities: [
      {
        id: "nonexistent-capability",
        description: "A surface that does not exist in the target",
        componentHints: ["UnbuiltCapabilitySurface"],
        tableHints: ["unbuilt_capability_table"]
      }
    ],
    proposedNewSurfaces: [{ kind: "component", name: "UnbuiltCapabilitySurface", capabilityId: "nonexistent-capability" }]
  };
}

// "Extend existing" example that needs no external repo: targets AppEngine's own
// components so tests can produce a deterministic extend_existing verdict in CI.
export function selfExtendExampleRequest() {
  return {
    request: {
      runId: "example-self-extend",
      title: "Existing surface extension",
      goal: "Demonstrate extend_existing without an external repo."
    },
    targetRepo: {
      name: "AppEngine-self",
      candidatePaths: ["src/components"],
      backupSchemaPaths: []
    },
    capabilities: [
      {
        id: "loop-intake",
        description: "Loop intake form surface",
        componentHints: ["loop-intake-form"]
      }
    ],
    proposedNewSurfaces: [{ kind: "component", name: "NewLoopIntakeForm", capabilityId: "loop-intake" }]
  };
}
