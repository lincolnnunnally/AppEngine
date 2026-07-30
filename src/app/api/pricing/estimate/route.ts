import { estimateBuild, listArchetypesForUi, listFeaturesForUi, profitReferenceTable } from "@/lib/engine/pricing";

export const dynamic = "force-dynamic";

/**
 * POST { featureIds?, archetypeId?, needText?, customWork?, moduleSlugs? }
 * GET  ?catalog=1 — features + archetypes + profit reference (ops)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("catalog") === "1") {
    return Response.json({
      ok: true,
      basePriceCents: 2500,
      featurePriceCents: 1000,
      features: listFeaturesForUi(),
      archetypes: listArchetypesForUi(),
      // Ops reference — do not show raw costs to end customers without framing
      profitReference: profitReferenceTable()
    });
  }
  return Response.json({
    ok: true,
    message: "POST a body to estimate, or GET ?catalog=1 for the sellable checklist."
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      featureIds?: string[];
      archetypeId?: string;
      needText?: string;
      customWork?: boolean;
      moduleSlugs?: string[];
    };
    const result = estimateBuild({
      featureIds: body.featureIds,
      archetypeId: body.archetypeId,
      needText: body.needText,
      customWork: body.customWork,
      moduleSlugs: body.moduleSlugs
    });
    if (!result.ok) {
      return Response.json(result, { status: 400 });
    }
    return Response.json(result);
  } catch (err) {
    console.error(err);
    return Response.json(
      { ok: false, message: err instanceof Error ? err.message : "Estimate failed." },
      { status: 500 }
    );
  }
}
