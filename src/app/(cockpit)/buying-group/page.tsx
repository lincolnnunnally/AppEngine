import { redirect } from "next/navigation";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { isGroupBuyConfigured } from "@/lib/group-buy/db";
import { listAllCampaigns, listGroups, listVendors } from "@/lib/group-buy/service";
import type { Vendor } from "@/lib/group-buy/types";

// Buying Group — the owner's view of the ecosystem's collective purchasing.
//
// Three questions, in the order they actually get asked:
//   1. Who will give us a bulk deal, and which of them can ship to each member?
//   2. What group orders are running, and how close are they to a threshold?
//   3. Which groups exist and which vendor accounts do they hold?
export const dynamic = "force-dynamic";

function usd(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function vendorLine(vendor: Vendor) {
  const bits: string[] = [];

  if (vendor.membership_fee_cents === 0) bits.push("free to join");
  if (vendor.ships_to_member_addresses) bits.push("ships to members");
  if (vendor.min_order_units) bits.push(`min ${vendor.min_order_units} units`);

  return bits.join(" · ");
}

export default async function BuyingGroupPage() {
  if (!(await canAccessEngineAdmin())) {
    redirect("/");
  }

  if (!isGroupBuyConfigured()) {
    return (
      <main className="shell">
        <section className="panel">
          <p className="dx-label">Buying Group</p>
          <h1 className="dx-display">Storage isn&rsquo;t configured</h1>
          <p className="dx-lede">
            Group Buy reads and writes the shared LPL Supabase. Set <code>SUPABASE_URL</code> and{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> in this app&rsquo;s environment and reload.
          </p>
        </section>
      </main>
    );
  }

  const [vendors, campaigns, groups] = await Promise.all([listVendors(), listAllCampaigns(), listGroups()]);

  const dropShip = vendors.filter((v) => v.ships_to_member_addresses);
  const gpos = vendors.filter((v) => v.kind === "gpo");
  const live = campaigns.filter((row) => ["open", "threshold_met"].includes(row.campaign.status));
  const committed = campaigns.filter((row) => ["locked", "ordered", "shipped"].includes(row.campaign.status));

  const totalSavings = campaigns.reduce((sum, row) => sum + (row.progress?.savings_cents ?? 0), 0);

  return (
    <main className="shell">
      <section className="panel">
        <p className="dx-label">Buying Group</p>
        <h1 className="dx-display">
          {live.length} group order{live.length === 1 ? "" : "s"} running
        </h1>
        <p className="dx-lede">
          Members across the community apps enter their own orders. Those orders pool against one vendor account
          so the group clears a bulk threshold nobody clears alone, then the vendor ships each member direct.
          {totalSavings > 0 ? ` ${usd(totalSavings)} saved so far.` : ""}
        </p>
      </section>

      {/* ---------------------------------------------------------------- campaigns */}
      <section className="panel" id="campaigns">
        <p className="dx-label">Live group orders</p>
        {live.length === 0 ? (
          <p className="dx-note">
            No group order is open. Create one against a vendor whose account is active — until then members have
            nothing to join.
          </p>
        ) : (
          <div>
            {live.map(({ campaign, progress, vendor, group }) => (
              <p className="dx-row" key={campaign.id}>
                <span>
                  <b>{campaign.title}</b>
                  <span className="dx-note">
                    {" "}
                    {group?.name} · {vendor?.name}
                  </span>
                </span>
                <span className="dx-note">
                  {progress?.committed_units ?? 0}/{campaign.min_units} units · {progress?.member_count ?? 0} members
                  {progress?.current_tier_label ? ` · ${progress.current_tier_label}` : ""}
                </span>
                <span className={progress?.threshold_met ? "dx-tag" : "dx-tag dx-tag--alert"}>
                  {progress?.threshold_met
                    ? "threshold met — ready to lock"
                    : `${progress?.units_remaining ?? campaign.min_units} more to unlock`}
                </span>
              </p>
            ))}
          </div>
        )}
      </section>

      {committed.length > 0 && (
        <section className="panel">
          <p className="dx-label">Committed to a vendor</p>
          {committed.map(({ campaign, progress, vendor }) => (
            <p className="dx-row" key={campaign.id}>
              <span>
                <b>{campaign.title}</b>
                <span className="dx-note"> {vendor?.name}</span>
              </span>
              <span className="dx-note">
                {campaign.po_number || "no PO"} · {progress?.member_count ?? 0} destinations ·{" "}
                {usd(progress?.savings_cents ?? 0)} saved
              </span>
              <a className="dx-tag" href={`/api/group-buy/campaigns/${campaign.id}/manifest`}>
                drop-ship CSV →
              </a>
            </p>
          ))}
        </section>
      )}

      {/* ---------------------------------------------------------------- supply side */}
      <section className="panel" id="vendors">
        <p className="dx-label">Can ship to each member ({dropShip.length})</p>
        <p className="dx-note">
          The only channels that can turn one group order into many individual deliveries. Everything else needs the
          goods to land somewhere and be redistributed by hand.
        </p>
        {dropShip.map((vendor) => (
          <p className="dx-row" key={vendor.id}>
            <span>
              {vendor.website ? (
                <a className="account-link" href={vendor.website} target="_blank" rel="noreferrer">
                  <b>{vendor.name}</b>
                </a>
              ) : (
                <b>{vendor.name}</b>
              )}
              <span className="dx-note"> {vendorLine(vendor)}</span>
            </span>
            <span className="dx-note">{vendor.discount_summary}</span>
            <span className={vendor.status === "active" ? "dx-tag" : "dx-tag dx-tag--alert"}>{vendor.status}</span>
          </p>
        ))}
      </section>

      <section className="panel">
        <p className="dx-label">Group purchasing organizations ({gpos.length})</p>
        <p className="dx-note">
          A GPO doesn&rsquo;t ship anything — it unlocks contract pricing at suppliers we already use. Joining one is
          the cheapest way to raise the whole network&rsquo;s buying power, and several charge nothing.
        </p>
        {gpos.map((vendor) => (
          <p className="dx-row" key={vendor.id}>
            <span>
              {vendor.join_url ? (
                <a className="account-link" href={vendor.join_url} target="_blank" rel="noreferrer">
                  <b>{vendor.name}</b>
                </a>
              ) : (
                <b>{vendor.name}</b>
              )}
              <span className="dx-note"> {vendor.eligibility.join(", ")}</span>
            </span>
            <span className="dx-note">{vendor.discount_summary}</span>
            <span className={vendor.status === "active" ? "dx-tag" : "dx-tag dx-tag--alert"}>{vendor.status}</span>
          </p>
        ))}
      </section>

      {/* ---------------------------------------------------------------- groups */}
      <section className="panel">
        <p className="dx-label">Buying groups ({groups.length})</p>
        {groups.length === 0 ? (
          <p className="dx-note">
            No buying group yet. A group is a church, neighborhood, club, or association whose members&rsquo; orders
            pool together.
          </p>
        ) : (
          groups.map((group) => (
            <p className="dx-row" key={group.id}>
              <span>
                <b>{group.name}</b>
                <span className="dx-note">
                  {" "}
                  {group.kind}
                  {group.app_slug ? ` · ${group.app_slug}` : ""}
                </span>
              </span>
              <span className="dx-note">
                {group.member_count_estimate > 0 ? `~${group.member_count_estimate} members` : "size unknown"}
                {group.tax_exempt ? " · tax exempt" : ""}
              </span>
              <span className="dx-tag">{group.status}</span>
            </p>
          ))
        )}
      </section>

      <section className="panel">
        <p className="dx-label">The rule that shapes all of this</p>
        <p className="dx-note">
          A nonprofit&rsquo;s sales-tax exemption does not extend to goods bought on behalf of individual members. A
          campaign marked <code>member_benefit</code> is therefore always taxable to the member, must drop-ship or be
          picked up, and can never assert the group&rsquo;s exemption — the database refuses to write a purchase
          order that tries. Buying for the organization&rsquo;s own use is a separate mode, <code>org_use</code>.
        </p>
      </section>
    </main>
  );
}
