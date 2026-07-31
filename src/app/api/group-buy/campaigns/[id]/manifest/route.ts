import { NextResponse } from "next/server";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { manifestToCsv } from "@/lib/group-buy/manifest";
import { generatePurchaseOrder, getManifest } from "@/lib/group-buy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The file you hand the vendor. CSV is one row per member per SKU — the shape
// every bulk-upload tool wants, including Amazon Business shared addresses.
// ?format=json returns the same manifest with its cohort structure intact.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canAccessEngineAdmin())) {
    return NextResponse.json({ ok: false, message: "Operator access required." }, { status: 403 });
  }

  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") || "csv";

  try {
    // Regenerate on read so an edited order can never ship against a stale file.
    let manifest = await getManifest(id);

    try {
      manifest = (await generatePurchaseOrder(id, "cockpit:manifest")).manifest;
    } catch {
      // Not locked yet — fall back to whatever was last generated.
    }

    if (!manifest) {
      return NextResponse.json(
        { ok: false, message: "No manifest yet. Lock the campaign to generate its purchase order." },
        { status: 404 }
      );
    }

    if (format === "json") {
      return NextResponse.json({ ok: true, manifest });
    }

    return new Response(manifestToCsv(manifest), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${manifest.po_number}-dropship.csv"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manifest failed.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
