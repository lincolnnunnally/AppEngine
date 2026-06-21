import { getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";

// Canonical app/project registry (durable).
//
// app_portfolio_registry is the single source of truth for what AppEngine has
// built or is building. A gated request registers an app/project here; completed
// loops attach as evidence here; prior_work_check searches here before
// recommending new build work. development_projects / project_memory are legacy
// derivation inputs, not competing sources of truth.

export type CompletedLoopEvidence = {
  runId: string;
  goal: string;
  status: string;
  gatePacketId?: string;
  cycleCount?: number;
  completedAt: string;
  evidence: string[];
};

export type RegisteredAppProject = {
  slug: string;
  name: string;
  type: string;
  status: string;
  gatePacketId?: string;
  priorWork?: { verdict?: string; passed?: boolean };
  sourceOfTruthFiles: string[];
  completedLoops: CompletedLoopEvidence[];
  createdAt: string;
  updatedAt: string;
};

type RegistryStore = {
  schemaVersion: 1;
  entries: RegisteredAppProject[];
};

type RegisterInput = {
  slug?: unknown;
  name?: unknown;
  type?: unknown;
  status?: unknown;
  gatePacketId?: unknown;
  priorWork?: { verdict?: string; passed?: boolean };
  sourceOfTruthFiles?: unknown;
};

function storeScope() {
  return { kind: "app_portfolio_registry" as const, key: "registered-apps" };
}

async function readStore(): Promise<RegistryStore> {
  return getAppEngineStateAdapter().readJson<RegistryStore>(storeScope(), { schemaVersion: 1, entries: [] });
}

async function writeStore(store: RegistryStore) {
  await getAppEngineStateAdapter().writeJson(storeScope(), store);
}

export async function listRegisteredAppProjects(): Promise<RegisteredAppProject[]> {
  const store = await readStore();
  return [...store.entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function registerAppProject(input: RegisterInput, now = new Date()): Promise<RegisteredAppProject> {
  const at = now.toISOString();
  const slug = cleanSlug(input.slug) || cleanSlug(input.name) || "app";
  const store = await readStore();
  const existing = store.entries.find((entry) => entry.slug === slug);

  if (existing) {
    existing.name = cleanText(input.name) || existing.name;
    existing.type = cleanText(input.type) || existing.type;
    existing.status = cleanText(input.status) || existing.status;
    if (cleanText(input.gatePacketId)) existing.gatePacketId = cleanText(input.gatePacketId);
    if (input.priorWork) existing.priorWork = input.priorWork;
    if (arr(input.sourceOfTruthFiles).length) existing.sourceOfTruthFiles = arr(input.sourceOfTruthFiles);
    existing.updatedAt = at;
    await writeStore(store);
    return existing;
  }

  const entry: RegisteredAppProject = {
    slug,
    name: cleanText(input.name) || slug,
    type: cleanText(input.type) || "app_project",
    status: cleanText(input.status) || "registered",
    gatePacketId: cleanText(input.gatePacketId) || undefined,
    priorWork: input.priorWork,
    sourceOfTruthFiles: arr(input.sourceOfTruthFiles),
    completedLoops: [],
    createdAt: at,
    updatedAt: at
  };

  store.entries.unshift(entry);
  await writeStore(store);
  return entry;
}

export async function attachCompletedLoop(
  slug: string,
  loop: { runId: string; goal: string; status: string; gatePacketId?: string; cycleCount?: number; evidence?: string[] },
  now = new Date()
): Promise<RegisteredAppProject> {
  const at = now.toISOString();
  const cleaned = cleanSlug(slug) || "app";
  const store = await readStore();
  let entry = store.entries.find((candidate) => candidate.slug === cleaned);

  if (!entry) {
    entry = {
      slug: cleaned,
      name: cleaned,
      type: "app_project",
      status: "registered",
      gatePacketId: loop.gatePacketId,
      sourceOfTruthFiles: [],
      completedLoops: [],
      createdAt: at,
      updatedAt: at
    };
    store.entries.unshift(entry);
  }

  entry.completedLoops.unshift({
    runId: cleanText(loop.runId),
    goal: cleanText(loop.goal),
    status: cleanText(loop.status) || "completed",
    gatePacketId: cleanText(loop.gatePacketId) || undefined,
    cycleCount: typeof loop.cycleCount === "number" ? loop.cycleCount : undefined,
    completedAt: at,
    evidence: arr(loop.evidence)
  });
  entry.updatedAt = at;

  await writeStore(store);
  return entry;
}

// Used by prior_work_check (via the shared store file) and callers that want to
// know whether prior work already exists for an app/capability.
export async function findRegisteredMatches(query: { slug?: string; terms?: string[] }): Promise<RegisteredAppProject[]> {
  const entries = await listRegisteredAppProjects();
  return entries.filter((entry) => matchesEntry(entry, query));
}

export function matchesEntry(entry: RegisteredAppProject, query: { slug?: string; terms?: string[] }): boolean {
  const slug = cleanSlug(query.slug);
  if (slug && entry.slug === slug) return true;

  const terms = (query.terms || []).map((term) => term.toLowerCase()).filter(Boolean);
  if (!terms.length) return false;

  const haystack = `${entry.slug} ${entry.name} ${entry.completedLoops.map((loop) => loop.goal).join(" ")}`.toLowerCase();
  return terms.some((term) => term.length >= 4 && haystack.includes(term));
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function cleanSlug(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function arr(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean);
  return [];
}
