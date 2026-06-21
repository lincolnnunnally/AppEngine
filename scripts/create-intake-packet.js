import fs from "node:fs";
import path from "node:path";

const packetOutput = process.env.INTAKE_PACKET_OUTPUT || "";
const followUpsOutput = process.env.INTAKE_FOLLOWUPS_OUTPUT || "";
const inputPath = process.env.INTAKE_INPUT || "";
const coreSourceOfTruthFiles = [
  "source-of-truth/00-why-we-build.md",
  "source-of-truth/01-ecosystem-philosophy.md",
  "source-of-truth/02-global-principles.md",
  "source-of-truth/03-life-produces-life.md",
  "source-of-truth/04-app-purpose-rules.md",
  "source-of-truth/05-ecosystem-design-gates.md"
];

const input = readInput(inputPath);
const rawIssueText = input.rawRequest || input.request || process.env.INTAKE_REQUEST || process.env.REQUEST_TEXT || "";
const embeddedHandoff = extractChatGptHandoff(rawIssueText);
const rawRequest = embeddedHandoff?.rawRequest || rawIssueText;
const source = {
  type: input.source?.type || process.env.INTAKE_SOURCE_TYPE || (embeddedHandoff ? "chatgpt_handoff_issue" : "github_issue_or_chat"),
  issueNumber: input.source?.issueNumber || process.env.SOURCE_ISSUE_NUMBER || "",
  issueUrl: input.source?.issueUrl || process.env.SOURCE_ISSUE_URL || "",
  author: input.source?.author || process.env.INTAKE_SOURCE_AUTHOR || "",
  handoffKind: embeddedHandoff?.kind || ""
};
const knownApps = normalizeKnownApps(input.knownApps || parseKnownApps(process.env.INTAKE_KNOWN_APPS || ""));

const packet = buildIntakePacket({
  rawRequest,
  source,
  knownApps,
  requestedAppName: input.appName || embeddedHandoff?.selectedApp?.name || process.env.APP_NAME || "",
  requestedSlug: input.slug || embeddedHandoff?.selectedApp?.slug || embeddedHandoff?.newAppSlug || process.env.APP_SLUG || ""
});

validateIntakePacket(packet);

if (packetOutput) writeJson(packetOutput, packet);
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks: packet.followUpTasks });

console.log(`intake-packet ok: ${packet.inferredApp.name} (${packet.inferredApp.status})`);
console.log(`workflow: ${packet.selectedWorkflow.packetKind}`);

function buildIntakePacket({ rawRequest, source, knownApps, requestedAppName, requestedSlug }) {
  const request = String(rawRequest || "").trim();
  const matches = findAppMatches(request, knownApps);
  const action = classifyAction(request);
  const hasExplicitApp = Boolean(requestedAppName || requestedSlug);

  if (!request) {
    return buildClarificationPacket({
      rawRequest: request,
      source,
      requestType: "ambiguous",
      confidence: 0,
      missingContext: ["raw request"],
      candidates: [],
      reason: "No request text was provided."
    });
  }

  if (matches.length > 1) {
    return buildClarificationPacket({
      rawRequest: request,
      source,
      requestType: "multi_app",
      confidence: 0.3,
      candidates: matches,
      missingContext: ["single selected app"],
      reason: "More than one known app matched the request."
    });
  }

  if (matches.length === 1) {
    const app = matches[0];
    const requestType = action.existingRequestType || "improvement";
    const missingContext = missingExistingAppContext(app);

    if (missingContext.length) {
      return buildClarificationPacket({
        rawRequest: request,
        source,
        requestType,
        confidence: 0.68,
        candidates: [app],
        missingContext,
        reason: "The app was identified, but required existing-app context is missing before vNext planning."
      });
    }

    return buildExistingAppPacket({
      rawRequest: request,
      source,
      app,
      requestType,
      confidence: action.hasAction ? 0.92 : 0.78,
      reason: "Known app matched and required existing-app context is loaded."
    });
  }

  if (hasExplicitApp && action.isExistingAction) {
    return buildClarificationPacket({
      rawRequest: request,
      source,
      requestType: action.existingRequestType || "improvement",
      confidence: 0.42,
      candidates: [],
      missingContext: ["known app match", "app charter", "Super Admin registry entry", "current version", "release history", "monitoring state", "open issues"],
      reason: "The request looks like an existing-app improvement, but the named app was not found in durable app sources."
    });
  }

  if (action.isNewAppAction) {
    const inferredName = requestedAppName || inferNewAppName(request) || "New App";
    const slug = requestedSlug || slugify(inferredName);

    return buildNewAppPacket({
      rawRequest: request,
      source,
      appName: inferredName,
      slug,
      confidence: inferredName === "New App" ? 0.55 : 0.82,
      missingContext: inferredName === "New App" ? ["app name", "app purpose", "audience"] : ["app purpose", "audience", "success definition"],
      reason: "No known app matched and the request uses new-app creation language."
    });
  }

  return buildClarificationPacket({
    rawRequest: request,
    source,
    requestType: action.existingRequestType || "ambiguous",
    confidence: 0.25,
    candidates: [],
    missingContext: ["request type", "specific app or new-app name"],
    reason: "The request did not clearly identify a new app or an existing app."
  });
}

function buildNewAppPacket({ rawRequest, source, appName, slug, confidence, missingContext, reason }) {
  const packet = basePacket({
    rawRequest,
    source,
    inferredApp: {
      name: appName,
      slug,
      status: "new",
      candidates: []
    },
    requestType: "new_app",
    confidence,
    missingContext,
    selectedWorkflow: {
      packetKind: "app_build_packet",
      priorWorkGate: "scripts/create-prior-work-check.js",
      priorWorkCheckRequired: true,
      requiredPriorWorkVerdict: "build_new",
      nextGenerator: "scripts/create-app-build-packet.js",
      recommendedLabels: ["ai:plan"],
      reason
    }
  });

  packet.followUpTasks = [
    {
      title: `[${slug}] Intake: Create App Build Packet`,
      recommendedLabel: "ai:plan",
      body: [
        `Create an App Build Packet for ${appName}.`,
        "",
        "## Intake Packet",
        `- Raw request: ${rawRequest}`,
        `- Inferred app: ${appName}`,
        `- Slug: ${slug}`,
        "- Request type: new_app",
        `- Confidence: ${confidence}`,
        `- Missing context: ${missingContext.join("; ") || "none"}`,
        "- Selected workflow: app_build_packet",
        "",
        "## Required Source Of Truth To Load",
        ...coreSourceOfTruthFiles.map((filePath) => `- ${filePath}`),
        "- source-of-truth/app-build-packet.md",
        "- source-of-truth/context-checklist.md",
        "- agents/manifest.yaml",
        "- agents/context/output-contracts.md",
        "",
        "## Required Next Step",
        "- Create an App Build Packet before implementation.",
        "- Break the app into phased follow-up issues.",
        "- Do not build the app directly from this raw request.",
        "- Do not deploy production from intake.",
        "",
        "## Guardrails",
        "- New apps require App Build Packet, app charter, boundaries, audience, success definition, MVP stages, deployment target, and Super Admin integration planning.",
        "- Keep the app inside its own charter and prevent app-goal bleeding.",
        "- Route later improvements to vNext after v1 launches."
      ].join("\n")
    }
  ];

  return packet;
}

function buildExistingAppPacket({ rawRequest, source, app, requestType, confidence, reason }) {
  const packet = basePacket({
    rawRequest,
    source,
    inferredApp: {
      name: app.name,
      slug: app.slug,
      status: "existing",
      candidates: [publicAppCandidate(app)]
    },
    requestType,
    confidence,
    missingContext: [],
    selectedWorkflow: {
      packetKind: "vnext_packet",
      priorWorkGate: "scripts/create-prior-work-check.js",
      priorWorkCheckRequired: true,
      requiredPriorWorkVerdict: "extend_existing",
      nextGenerator: "scripts/create-vnext-packet.js",
      recommendedLabels: ["ai:plan"],
      reason
    }
  });

  packet.appContext = {
    charterLoaded: true,
    registryLoaded: true,
    currentVersionLoaded: true,
    releaseHistoryLoaded: true,
    monitoringLoaded: true,
    knownIssuesLoaded: true,
    openIssuesLoaded: true,
    charterPath: app.charterPath,
    registrySource: app.registrySource,
    currentVersion: app.currentVersion,
    releaseHistorySource: app.releaseHistorySource,
    monitoringSource: app.monitoringSource,
    openIssuesSource: app.openIssuesSource,
    knownIssues: app.knownIssues
  };

  packet.followUpTasks = [
    {
      title: `[${app.slug}] Intake: Create vNext Packet`,
      recommendedLabel: "ai:plan",
      body: [
        `Create a vNext Packet for ${app.name}.`,
        "",
        "## Intake Packet",
        `- Raw request: ${rawRequest}`,
        `- Existing app: ${app.name}`,
        `- Slug: ${app.slug}`,
        `- Current version: ${app.currentVersion}`,
        `- Request type: ${requestType}`,
        `- Confidence: ${confidence}`,
        "- Selected workflow: vnext_packet",
        "",
        "## Required Loaded Context",
        `- Charter: ${app.charterPath}`,
        `- Super Admin registry: ${app.registrySource}`,
        `- Release history: ${app.releaseHistorySource}`,
        `- Monitoring state: ${app.monitoringSource}`,
        `- Known issues: ${app.knownIssues.join("; ") || "none recorded"}`,
        `- Open issues: ${app.openIssuesSource}`,
        "",
        "## Required Source Of Truth To Load",
        ...coreSourceOfTruthFiles.map((filePath) => `- ${filePath}`),
        `- ${app.charterPath}`,
        "- source-of-truth/app-improvement-vnext-packet.md",
        "- source-of-truth/context-checklist.md",
        "- agents/manifest.yaml",
        "- agents/context/output-contracts.md",
        "",
        "## Required Next Step",
        "- Create a vNext Packet before implementation.",
        "- Preserve the current app charter, version, release history, registry, monitoring state, and open issues.",
        "- Do not restart the whole app.",
        "- Do not import unrelated app goals, audiences, data, or workflows.",
        "",
        "## Guardrails",
        "- Existing-app requests require vNext packets.",
        "- Broad v2 work must still preserve existing context and release history.",
        "- Production changes require Release Gate approval."
      ].join("\n")
    }
  ];

  return packet;
}

function buildClarificationPacket({ rawRequest, source, requestType, confidence, missingContext, candidates, reason }) {
  const status = requestType === "multi_app" ? "multi_app" : "ambiguous";
  const candidateList = candidates.map(publicAppCandidate);
  const displayName = candidateList.length ? candidateList.map((app) => app.name).join(", ") : "Unselected app";

  const packet = basePacket({
    rawRequest,
    source,
    inferredApp: {
      name: displayName,
      slug: candidateList.length === 1 ? candidateList[0].slug : "",
      status,
      candidates: candidateList
    },
    requestType,
    confidence,
    missingContext,
    selectedWorkflow: {
      packetKind: "intake_clarification",
      nextGenerator: "",
      recommendedLabels: ["ai:plan"],
      reason
    }
  });

  packet.followUpTasks = [
    {
      title: status === "multi_app" ? "[intake] Split multi-app request" : "[intake] Clarify app selection",
      recommendedLabel: "ai:plan",
      body: [
        "Clarify this intake request before planning or building.",
        "",
        "## Intake Packet",
        `- Raw request: ${rawRequest || "(missing)"}`,
        `- Request type: ${requestType}`,
        `- Confidence: ${confidence}`,
        `- Candidates: ${candidateList.map((app) => app.name).join(", ") || "none"}`,
        `- Missing context: ${missingContext.join("; ") || "none"}`,
        "- Selected workflow: intake_clarification",
        "",
        "## Required Source Of Truth To Load",
        ...coreSourceOfTruthFiles.map((filePath) => `- ${filePath}`),
        "- source-of-truth/app-selection-standard.md",
        "- source-of-truth/context-checklist.md",
        "- agents/manifest.yaml",
        "- agents/context/output-contracts.md",
        "",
        "## Required Next Step",
        "- Identify exactly one app or confirm this is a new app.",
        "- If this is a multi-app integration, create one integration issue plus one scoped issue per affected app.",
        "- Do not create an App Build Packet or vNext Packet until app selection is clear.",
        "- Do not implement from ambiguous intake text."
      ].join("\n")
    }
  ];

  return packet;
}

function basePacket({ rawRequest, source, inferredApp, requestType, confidence, missingContext, selectedWorkflow }) {
  return {
    kind: "intake_packet",
    schemaVersion: 1,
    rawRequest,
    source,
    inferredApp,
    requestType,
    confidence,
    missingContext,
    selectedWorkflow,
    nextIssueLabels: selectedWorkflow.recommendedLabels,
    sourceOfTruthFiles: coreSourceOfTruthFiles,
    requiredExistingAppContext: [
      "app charter",
      "Super Admin registry entry",
      "current version",
      "release history",
      "monitoring state",
      "known issues",
      "open issues"
    ],
    appContext: {
      charterLoaded: false,
      registryLoaded: false,
      currentVersionLoaded: false,
      releaseHistoryLoaded: false,
      monitoringLoaded: false,
      knownIssuesLoaded: false,
      openIssuesLoaded: false
    },
    guardrails: {
      newAppsRequireAppBuildPacket: true,
      existingAppsRequireVNextPacket: true,
      requiresDisambiguationWhenAmbiguous: true,
      blocksMultiAppRequests: true,
      preventsBoundaryBleed: true,
      noProductionDeployFromIntake: true
    },
    followUpTasks: []
  };
}

function classifyAction(request) {
  const text = normalize(request);
  const isFix = /\b(fix|repair|broken|bug|error|failed|failing)\b/.test(text);
  const isFeature = /\b(add|feature|include|support|integrate|connect)\b/.test(text);
  const isV2 = /\b(v2|version 2|version two|next version|major version)\b/.test(text);
  const isFeedback = /\b(feedback|user said|users said|customer said|respond to|complaint)\b/.test(text);
  const isImprove = /\b(improve|update|upgrade|make|easier|better|simpler|polish)\b/.test(text);
  const isNewAppAction = /\b(build|create|start|new app|app idea|launch an app|make an app)\b/.test(text) && !isImprove && !isFix && !isFeature && !isV2 && !isFeedback;
  const isExistingAction = isFix || isFeature || isV2 || isFeedback || isImprove;

  let existingRequestType = "";
  if (isFix) existingRequestType = "fix";
  else if (isFeature) existingRequestType = "feature";
  else if (isV2) existingRequestType = "v2";
  else if (isFeedback) existingRequestType = "feedback";
  else if (isImprove) existingRequestType = "improvement";

  return {
    hasAction: isNewAppAction || isExistingAction,
    isNewAppAction,
    isExistingAction,
    existingRequestType
  };
}

function findAppMatches(request, knownApps) {
  const text = normalize(request);
  if (!text) return [];

  return knownApps
    .map((app) => {
      const matchedBy = [];
      const names = unique([app.name, app.slug, ...app.aliases]).filter(Boolean);

      for (const name of names) {
        const normalizedName = normalize(name);
        if (normalizedName && text.includes(normalizedName)) {
          matchedBy.push(name === app.name ? "name" : name === app.slug ? "slug" : "alias");
        }
      }

      return matchedBy.length ? { ...app, matchedBy: unique(matchedBy) } : null;
    })
    .filter(Boolean);
}

function normalizeKnownApps(apps) {
  if (!Array.isArray(apps)) return [];

  return apps
    .map((app) => {
      const name = String(app.name || "").trim();
      const slug = String(app.slug || slugify(name)).trim();
      if (!name || !slug) return null;

      return {
        name,
        slug,
        aliases: Array.isArray(app.aliases) ? app.aliases.map(String) : [],
        currentVersion: String(app.currentVersion || "").trim(),
        charterPath: String(app.charterPath || "").trim(),
        registrySource: String(app.registrySource || "").trim(),
        releaseHistorySource: String(app.releaseHistorySource || "").trim(),
        monitoringSource: String(app.monitoringSource || "").trim(),
        openIssuesSource: String(app.openIssuesSource || "").trim(),
        knownIssues: Array.isArray(app.knownIssues) ? app.knownIssues.map(String) : []
      };
    })
    .filter(Boolean);
}

function parseKnownApps(raw) {
  const value = String(raw || "").trim();
  if (!value) return [];

  if (value.startsWith("[")) {
    return JSON.parse(value);
  }

  return value
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, slug, currentVersion] = entry.split(":").map((part) => part.trim());
      return {
        name,
        slug: slug || slugify(name),
        currentVersion: currentVersion || "v1",
        charterPath: `source-of-truth/charters/${slug || slugify(name)}.md`,
        registrySource: `Super Admin registry entry for ${slug || slugify(name)}`,
        releaseHistorySource: `Release history for ${slug || slugify(name)}`,
        monitoringSource: `Monitoring report for ${slug || slugify(name)}`,
        openIssuesSource: `Open GitHub issues for ${slug || slugify(name)}`,
        knownIssues: [],
        aliases: []
      };
    });
}

function missingExistingAppContext(app) {
  const missing = [];

  if (!app.charterPath) missing.push("app charter");
  if (!app.registrySource) missing.push("Super Admin registry entry");
  if (!app.currentVersion) missing.push("current version");
  if (!app.releaseHistorySource) missing.push("release history");
  if (!app.monitoringSource) missing.push("monitoring state");
  if (!Array.isArray(app.knownIssues)) missing.push("known issues");
  if (!app.openIssuesSource) missing.push("open issues");

  return missing;
}

function inferNewAppName(request) {
  const cleaned = String(request || "")
    .replace(/[?.!]+$/g, "")
    .trim();

  const patterns = [
    /\b(?:build|create|start|make)\s+(?:a|an|the)?\s*(.+?)(?:\s+app)?(?:\s+for\s+.+)?$/i,
    /\bnew\s+app\s+(?:for|called|named)?\s*(.+)$/i
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (!match?.[1]) continue;

    const value = titleCase(
      match[1]
        .replace(/\bappengine build\b/gi, "")
        .replace(/\bthis app\b/gi, "")
        .replace(/\bapp\b/gi, "")
        .trim()
    );

    if (value) return value;
  }

  return "";
}

function publicAppCandidate(app) {
  return {
    name: app.name,
    slug: app.slug,
    matchedBy: app.matchedBy || [],
    currentVersion: app.currentVersion || "",
    charterPath: app.charterPath || ""
  };
}

function validateIntakePacket(packet) {
  const missing = [];
  const validTypes = new Set(["new_app", "improvement", "feature", "fix", "v2", "feedback", "ambiguous", "multi_app"]);
  const validPackets = new Set(["app_build_packet", "vnext_packet", "intake_clarification"]);

  for (const [label, value] of [
    ["kind", packet.kind],
    ["rawRequest", packet.rawRequest],
    ["inferredApp.status", packet.inferredApp?.status],
    ["requestType", packet.requestType],
    ["selectedWorkflow.packetKind", packet.selectedWorkflow?.packetKind]
  ]) {
    if (!value) missing.push(label);
  }

  if (packet.kind !== "intake_packet") missing.push("kind=intake_packet");
  if (!validTypes.has(packet.requestType)) missing.push("valid requestType");
  if (!validPackets.has(packet.selectedWorkflow?.packetKind)) missing.push("valid selectedWorkflow.packetKind");
  if (!Array.isArray(packet.nextIssueLabels) || !packet.nextIssueLabels.includes("ai:plan")) missing.push("nextIssueLabels.ai:plan");
  if (!Array.isArray(packet.followUpTasks) || packet.followUpTasks.length === 0) missing.push("followUpTasks");

  if (packet.inferredApp?.status === "new" && packet.selectedWorkflow?.packetKind !== "app_build_packet") {
    missing.push("new app must route to app_build_packet");
  }

  if (packet.inferredApp?.status === "existing") {
    if (packet.selectedWorkflow?.packetKind !== "vnext_packet") missing.push("existing app must route to vnext_packet");
    for (const flag of ["charterLoaded", "registryLoaded", "currentVersionLoaded", "releaseHistoryLoaded", "monitoringLoaded", "knownIssuesLoaded", "openIssuesLoaded"]) {
      if (!packet.appContext?.[flag]) missing.push(`appContext.${flag}`);
    }
  }

  if ((packet.inferredApp?.status === "ambiguous" || packet.inferredApp?.status === "multi_app") && packet.selectedWorkflow?.packetKind !== "intake_clarification") {
    missing.push("unclear intake must route to intake_clarification");
  }

  if (!packet.guardrails?.newAppsRequireAppBuildPacket || !packet.guardrails?.existingAppsRequireVNextPacket || !packet.guardrails?.preventsBoundaryBleed) {
    missing.push("guardrails");
  }

  if (missing.length) throw new Error(`Intake packet is missing required fields: ${missing.join(", ")}`);
}

function readInput(filePath) {
  if (!filePath) return {};
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return {};
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function extractChatGptHandoff(text) {
  const blocks = [...String(text || "").matchAll(/```json\s*([\s\S]*?)```/gi)].map((match) => match[1]);

  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block);
      if (parsed?.kind === "chatgpt_handoff_packet") return parsed;
    } catch {
      // Keep looking for a valid handoff block.
    }
  }

  return null;
}

function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "app";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
