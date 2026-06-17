import { randomUUID } from "node:crypto";
import { getAppEngineAuditTrail } from "@/lib/engine/audit-trail-lite";
import { durableStateGuardrails, getAppEngineStateAdapter } from "@/lib/engine/durable-state-adapter";
import { listFirstRealEcosystemBuildRequests } from "@/lib/engine/first-real-ecosystem-build-request";
import { updateProjectMemoryFromFirstEcosystemBuildPacketDraft } from "@/lib/engine/project-memory";

export type FirstEcosystemBuildPacketDraftRecord = {
  id: string;
  kind: "first_ecosystem_build_packet_draft";
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  status: "review_ready_draft";
  sourceBuildRequestId: string;
  sourcePreparedHandoffId: string;
  title: "Life Produces Life Core: First Ecosystem Slice";
  appName: "Life Produces Life Core";
  ecosystem: "United Under God ecosystem foundation";
  purpose: string;
  userBenefit: string;
  coreFeatures: string[];
  requiredScreensRoutes: FirstEcosystemBuildPacketRoute[];
  dataModelNeeds: string[];
  designIntent: {
    profile: "ministry_community";
    emotionalExperience: string[];
    styleNotes: string[];
    avoid: string[];
  };
  acceptanceCriteria: string[];
  guardrailNotes: string[];
  nextSafeAction: "owner_review_build_packet_draft";
  ownerReadableSummary: string;
  copyableNextAppEnginePrompt: string;
  sourceEvidence: FirstEcosystemBuildPacketSourceEvidence[];
  artifact: FirstEcosystemBuildPacketDraftArtifact;
  guardrails: ReturnType<typeof firstEcosystemBuildPacketDraftGuardrails>;
};

export type FirstEcosystemBuildPacketRoute = {
  route: string;
  label: string;
  purpose: string;
};

export type FirstEcosystemBuildPacketSourceEvidence = {
  kind: "first_real_ecosystem_build_request" | "handoff_relay_summary" | "life_core_foundation";
  id?: string;
  summary: string;
};

export type FirstEcosystemBuildPacketDraftArtifact = {
  kind: "first_ecosystem_build_packet_draft";
  schemaVersion: 1;
  sourceArtifact: {
    kind: "first_real_ecosystem_build_request";
    id: string;
    preparedHandoffId: string;
  };
  packetDraft: {
    status: "review_ready_draft";
    finalPacketCreated: false;
    codexTriggered: false;
    githubIssuesCreated: false;
    deployed: false;
  };
  nextSafeAction: "owner_review_build_packet_draft";
  ownerApprovalRequired: true;
  guardrails: ReturnType<typeof firstEcosystemBuildPacketDraftGuardrails>;
};

type FirstEcosystemBuildPacketDraftStore = {
  schemaVersion: 1;
  records: FirstEcosystemBuildPacketDraftRecord[];
};

export function firstEcosystemBuildPacketDraftGuardrails() {
  return {
    ...durableStateGuardrails(),
    usesPreparedLifeCoreHandoff: true,
    reviewReadyDraftOnly: true,
    ownerApprovalRequired: true,
    noFinalPacketCreated: true,
    noCodexAutoExecution: true,
    noGitHubIssueCreation: true,
    noLabelChanges: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noLiveMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true
  };
}

export async function listFirstEcosystemBuildPacketDrafts() {
  const store = await readFirstEcosystemBuildPacketDraftStore();
  return [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createFirstEcosystemBuildPacketDraft(input: { sourceBuildRequestId?: unknown } = {}, now = new Date()) {
  const buildRequests = await listFirstRealEcosystemBuildRequests();
  const sourceBuildRequestId = typeof input.sourceBuildRequestId === "string" ? input.sourceBuildRequestId.trim() : "";
  const sourceBuildRequest = sourceBuildRequestId
    ? buildRequests.find((request) => request.id === sourceBuildRequestId)
    : buildRequests[0];

  if (!sourceBuildRequest) {
    throw new Error("Run the First Real Ecosystem Build Request before preparing the first ecosystem build packet draft.");
  }

  if (!sourceBuildRequest.preparedHandoff.id) {
    throw new Error("The first ecosystem build request must have a prepared handoff before a build packet draft can be prepared.");
  }

  const createdAt = now.toISOString();
  const sourceEvidence = buildSourceEvidence(sourceBuildRequest);
  const record: FirstEcosystemBuildPacketDraftRecord = {
    id: `first_ecosystem_packet_${randomUUID()}`,
    kind: "first_ecosystem_build_packet_draft",
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
    status: "review_ready_draft",
    sourceBuildRequestId: sourceBuildRequest.id,
    sourcePreparedHandoffId: sourceBuildRequest.preparedHandoff.id,
    title: "Life Produces Life Core: First Ecosystem Slice",
    appName: "Life Produces Life Core",
    ecosystem: "United Under God ecosystem foundation",
    purpose:
      "Create the first review-ready Life Produces Life Core slice as the shared foundation for the United Under God ecosystem, where transformation is the product and apps are tools.",
    userBenefit:
      "Lincoln can see and review the ecosystem foundation before deeper app work begins, and future builders get a clear shared starting point that prevents purpose bleed.",
    coreFeatures: [
      "Owner-facing Life Produces Life Core overview",
      "Human journey and community cycle framing",
      "Clear distinction that apps are tools and transformation is the product",
      "Ecosystem slice cards for future apps/services without pretending they are fully built",
      "Next safe AppEngine action handoff for the first build slice"
    ],
    requiredScreensRoutes: [
      {
        route: "/life-core",
        label: "Life Core public preview",
        purpose: "Show the shared ecosystem foundation, journey, community cycle, and next-step orientation."
      },
      {
        route: "/owner-control-center",
        label: "Owner review",
        purpose: "Show packet readiness, portfolio state, handoff state, memory, and guardrails for the owner."
      }
    ],
    dataModelNeeds: [
      "life_core_overview for journey, cycle, experiences, opportunities, testimonies, and feed contracts",
      "app_portfolio_registry entry for Life Produces Life Core status and next safe action",
      "handoff_relay_summary source for the prepared AppEngine handoff",
      "project_memory updates for decisions, progress, blockers, and next action",
      "append-only audit trail event for packet draft creation"
    ],
    designIntent: {
      profile: "ministry_community",
      emotionalExperience: ["hopeful", "warm", "grounded", "clear", "inviting"],
      styleNotes: [
        "Use plain language before systems language.",
        "Make the next step obvious.",
        "Show doctrine and usefulness together.",
        "Keep phone review comfortable."
      ],
      avoid: ["generic dashboard tone", "cold technical language", "claims that future apps are already finished"]
    },
    acceptanceCriteria: [
      "The draft visibly traces back to the First Real Ecosystem Build Request prepared handoff.",
      "The draft names purpose, user benefit, core features, routes, data model needs, design intent, acceptance criteria, guardrails, and next safe action.",
      "Owner Control Center shows the draft in a warm, useful, easy-to-scan format.",
      "Portfolio Dashboard reflects Life Produces Life Core packet draft readiness.",
      "Project Memory and Audit Trail are updated.",
      "No final packet, Codex run, GitHub issue, label, production deploy, paid resource, migration, secret/env change, or repo visibility change occurs."
    ],
    guardrailNotes: [
      "Owner approval is required before this draft becomes a final packet.",
      "Codex is not triggered automatically.",
      "GitHub issues and labels are not created.",
      "Production deployment, paid resources, live migrations, and secrets/env changes remain blocked."
    ],
    nextSafeAction: "owner_review_build_packet_draft",
    ownerReadableSummary:
      "First ecosystem build packet draft is ready for owner review. It converts the prepared Life Produces Life Core handoff into a concrete, reviewable AppEngine packet draft without starting implementation.",
    copyableNextAppEnginePrompt: buildNextPrompt(),
    sourceEvidence,
    artifact: buildArtifact(sourceBuildRequest, sourceEvidence),
    guardrails: firstEcosystemBuildPacketDraftGuardrails()
  };

  await writeFirstEcosystemBuildPacketDraft(record);
  await updateProjectMemoryFromFirstEcosystemBuildPacketDraft(record);
  await getAppEngineAuditTrail().append({
    type: "opportunity_packet_draft_prepared",
    actor: { type: "owner", id: "Lincoln" },
    summary: record.ownerReadableSummary,
    subjectId: record.id,
    metadata: {
      sourceBuildRequestId: record.sourceBuildRequestId,
      sourcePreparedHandoffId: record.sourcePreparedHandoffId,
      appName: record.appName,
      finalPacketCreated: false,
      codexTriggered: false,
      githubIssuesCreated: false,
      deployed: false
    }
  });

  return record;
}

function buildSourceEvidence(
  sourceBuildRequest: Awaited<ReturnType<typeof listFirstRealEcosystemBuildRequests>>[number]
): FirstEcosystemBuildPacketSourceEvidence[] {
  return [
    {
      kind: "first_real_ecosystem_build_request",
      id: sourceBuildRequest.id,
      summary: sourceBuildRequest.ownerReadableSummary
    },
    {
      kind: "handoff_relay_summary",
      id: sourceBuildRequest.preparedHandoff.id,
      summary: sourceBuildRequest.preparedHandoff.expectedOutcome
    },
    {
      kind: "life_core_foundation",
      summary: "Life Produces Life Core is the shared foundation for the United Under God ecosystem."
    }
  ];
}

function buildArtifact(
  sourceBuildRequest: Awaited<ReturnType<typeof listFirstRealEcosystemBuildRequests>>[number],
  sourceEvidence: FirstEcosystemBuildPacketSourceEvidence[]
): FirstEcosystemBuildPacketDraftArtifact {
  return {
    kind: "first_ecosystem_build_packet_draft",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "first_real_ecosystem_build_request",
      id: sourceBuildRequest.id,
      preparedHandoffId: sourceBuildRequest.preparedHandoff.id
    },
    packetDraft: {
      status: "review_ready_draft",
      finalPacketCreated: false,
      codexTriggered: false,
      githubIssuesCreated: false,
      deployed: false
    },
    nextSafeAction: "owner_review_build_packet_draft",
    ownerApprovalRequired: true,
    guardrails: firstEcosystemBuildPacketDraftGuardrails()
  };
}

function buildNextPrompt() {
  return [
    "Review the First Ecosystem Build Packet Draft.",
    "",
    "Goal:",
    "Decide whether the Life Produces Life Core first ecosystem slice is ready to become a final packet later.",
    "",
    "Focus:",
    "- Life Produces Life Core as shared foundation",
    "- United Under God ecosystem foundation",
    "- transformation is the product",
    "- apps are tools",
    "- owner review before implementation",
    "",
    "Required verification:",
    "- npm run source:check",
    "- npm run smoke:first-ecosystem-build-packet-draft",
    "- npm run smoke:first-real-ecosystem-build-request",
    "- npm run typecheck",
    "- npm run build",
    "",
    "Guardrails:",
    "- Do not trigger Codex automatically.",
    "- Do not create GitHub issues.",
    "- Do not apply labels.",
    "- Do not create a final packet automatically.",
    "- Do not deploy production.",
    "- Do not create paid resources.",
    "- Do not run live migrations.",
    "- Do not add secrets or env vars.",
    "- Do not change repository visibility."
  ].join("\n");
}

async function readFirstEcosystemBuildPacketDraftStore(): Promise<FirstEcosystemBuildPacketDraftStore> {
  return getAppEngineStateAdapter().readJson<FirstEcosystemBuildPacketDraftStore>(
    { kind: "internal_controlled_use_trials", key: "first-ecosystem-build-packet-draft" },
    { schemaVersion: 1, records: [] }
  );
}

async function writeFirstEcosystemBuildPacketDraft(record: FirstEcosystemBuildPacketDraftRecord) {
  const store = await readFirstEcosystemBuildPacketDraftStore();
  await getAppEngineStateAdapter().writeJson(
    { kind: "internal_controlled_use_trials", key: "first-ecosystem-build-packet-draft" },
    {
      schemaVersion: 1,
      records: [record, ...store.records.filter((item) => item.sourceBuildRequestId !== record.sourceBuildRequestId)].slice(0, 20)
    }
  );
}
