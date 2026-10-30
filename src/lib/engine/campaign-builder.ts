// Campaign Builder — server side. Builds the template kit, optionally lets the
// AI provider reword it, and keeps the template whenever the AI answer is
// missing, mis-shaped, or breaks a copy rule. The AI is never required.
// SERVER ONLY.
import "server-only";
import { hasAiProvider, xaiJson } from "@/lib/xai";
import {
  buildCampaignKit,
  copyProblems,
  mergePolishedCopy,
  polishableCopy,
  type CampaignBrief,
  type CampaignKit,
  type CopyProblem
} from "@/lib/engine/campaign-builder-core";

export type GeneratedCampaign = {
  kit: CampaignKit;
  problems: CopyProblem[];
  /** Why the AI wording was not used, when it was tried. */
  polishNote: string;
};

const SYSTEM = [
  "You improve marketing copy for a small company's email campaign and landing page.",
  "You receive a brief and a JSON draft. Return JSON with EXACTLY the same keys, array lengths and order.",
  "Rewrite for warmth, clarity and plain words. Keep it honest: never add facts, numbers, prices, names,",
  "testimonials, guarantees, rankings or claims that are not in the brief or the draft.",
  "Every email body must keep its link exactly as written. Subject A and subject B must stay different.",
  "Landing title at most 60 characters. Landing metaDescription between 120 and 165 characters.",
  "Never use any phrase the brief's rules forbid."
].join(" ");

async function polish(brief: CampaignBrief, kit: CampaignKit): Promise<{ kit: CampaignKit | null; note: string }> {
  try {
    const answer = await xaiJson({
      system: SYSTEM,
      user: JSON.stringify({
        brief: {
          company: brief.company,
          product: brief.product,
          audience: brief.audience,
          offer: brief.offer,
          proof: brief.proof ?? [],
          rules: brief.rules ?? [],
          bidders: brief.bidders ?? null
        },
        draft: polishableCopy(kit)
      }),
      maxTokens: 6000,
      timeoutMs: 90_000
    });
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(answer);
    } catch {
      return { kit: null, note: "The AI answer was not readable; kept the template wording." };
    }
    const merged = mergePolishedCopy(kit, parsed);
    return merged
      ? { kit: merged, note: "" }
      : { kit: null, note: "The AI wording changed the shape or broke a copy rule; kept the template wording." };
  } catch {
    return { kit: null, note: "The AI did not answer; kept the template wording." };
  }
}

export async function generateCampaign(brief: CampaignBrief, options: { polish?: boolean } = {}): Promise<GeneratedCampaign> {
  const template = buildCampaignKit(brief);
  let kit = template;
  let polishNote = "";
  if (options.polish && hasAiProvider()) {
    const result = await polish(brief, template);
    if (result.kit) kit = result.kit;
    polishNote = result.note;
  } else if (options.polish) {
    polishNote = "No AI provider is set up; used the template wording.";
  }
  return { kit, problems: copyProblems(kit), polishNote };
}

export function canPolish(): boolean {
  return hasAiProvider();
}
