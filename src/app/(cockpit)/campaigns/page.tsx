import { redirect } from "next/navigation";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { listCampaigns } from "@/lib/engine/campaigns";
import { canPolish } from "@/lib/engine/campaign-builder";
import { CampaignBuilder } from "@/components/engine/campaign-builder";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  if (!(await canAccessEngineAdmin())) redirect("/");
  const campaigns = await listCampaigns(50);

  return (
    <main className="shell">
      <section className="panel">
        <p className="dx-label">Campaigns</p>
        <h1 className="dx-display">
          Have an idea? We build the <em>whole campaign</em>.
        </h1>
        <p className="dx-lede">
          Tell us the company, the product and who it is for. You get the emails (with two subject lines to test), the
          landing page words, a plan for watching how it does, and a launch checklist — checked against your rules before
          anything goes out.
        </p>
      </section>
      <CampaignBuilder initial={campaigns} aiReady={canPolish()} />
    </main>
  );
}
