import { redirect } from "next/navigation";
import { CampaignForm, OpenCampaignButton, VendorForm } from "@/components/group-buy/operator-desk";
import { VendorConnectButton } from "@/components/group-buy/vendor-connect-button";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { GroupBuyDbError, isGroupBuyConfigured } from "@/lib/group-buy/db";
import { readVendorPayout, refreshVendorPayout, stripeConnectConfigured } from "@/lib/group-buy/connect";
import { listAllCampaigns, listGroups, listVendors } from "@/lib/group-buy/service";
import type { BuyingGroup, Campaign, CampaignProgress, Vendor } from "@/lib/group-buy/types";

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

function payoutLabel(vendor: Vendor) {
  const payout = readVendorPayout(vendor);
  if (payout.payoutsEnabled) return "payouts ready";
  if (payout.accountId) return "Stripe started";
  return "no Stripe payouts";
}

function noticeCopy(notice?: string) {
  if (notice === "vendor-saved") {
    return "Vendor saved. If they ship to members, invite them to Stripe from their row.";
  }

  if (notice === "campaign-open") {
    return "Campaign is open. Operate /buy and GET /api/group-buy/public/campaigns list it now.";
  }

  if (notice === "campaign-draft") {
    return "Campaign saved as a draft. Open it when the threshold and at least one SKU are in place.";
  }

  return null;
}

function VendorIdentity({ vendor }: { vendor: Vendor }) {
  const href = vendor.kind === "gpo" ? vendor.join_url : vendor.website;

  return (
    <span>
      {href ? (
        <a className="account-link" href={href} target="_blank" rel="noreferrer">
          <b>{vendor.name}</b>
        </a>
      ) : (
        <b>{vendor.name}</b>
      )}
      <span className="dx-note">
        {" "}
        {vendor.kind}
        {vendorLine(vendor) ? ` · ${vendorLine(vendor)}` : ""}
      </span>
    </span>
  );
}

export default async function BuyingGroupPage({
  searchParams
}: {
  searchParams?: Promise<{ connect?: string; vendor?: string; editVendor?: string; notice?: string }>;
}) {
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

  const params = searchParams ? await searchParams : {};
  let vendors: Vendor[] = [];
  let campaigns: Array<{
    campaign: Campaign;
    progress: CampaignProgress | null;
    vendor: Pick<Vendor, "id" | "slug" | "name"> | null;
    group: Pick<BuyingGroup, "id" | "slug" | "name" | "kind"> | null;
  }> = [];
  let groups: BuyingGroup[] = [];

  try {
    vendors = await listVendors();

    if (params.vendor && (params.connect === "done" || params.connect === "refresh")) {
      const returning = vendors.find((row) => row.id === params.vendor);
      if (returning) {
        const refreshed = await refreshVendorPayout(returning).catch(() => null);
        if (refreshed) {
          vendors = vendors.map((row) => (row.id === refreshed.vendor.id ? refreshed.vendor : row));
        }
      }
    }

    [campaigns, groups] = await Promise.all([listAllCampaigns(), listGroups()]);
  } catch (error) {
    const message =
      error instanceof GroupBuyDbError
        ? `${error.message}${error.detail ? ` — ${error.detail}` : ""}`
        : error instanceof Error
          ? error.message
          : "Could not read Group Buy storage.";

    return (
      <main className="shell">
        <section className="panel">
          <p className="dx-label">Buying Group</p>
          <h1 className="dx-display">Storage didn&rsquo;t answer</h1>
          <p className="dx-lede">{message}</p>
        </section>
      </main>
    );
  }

  const editing = params.editVendor ? vendors.find((row) => row.id === params.editVendor) || null : null;
  const notice = noticeCopy(params.notice);

  const dropShip = vendors.filter((v) => v.ships_to_member_addresses);
  const gpos = vendors.filter((v) => v.kind === "gpo");
  const otherVendors = vendors.filter((v) => !v.ships_to_member_addresses && v.kind !== "gpo");
  const live = campaigns.filter((row) => ["open", "threshold_met"].includes(row.campaign.status));
  const drafts = campaigns.filter((row) => row.campaign.status === "draft");
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
        <p className="dx-note">
          Payouts run on the verified United Under God Stripe account. Invite a vendor below — they finish Stripe&rsquo;s
          form, then a member can pay once: we keep the campaign commission, they receive the rest.
          {!stripeConnectConfigured()
            ? " This desk does not have STRIPE_SECRET_KEY yet, so the invite button will say so instead of opening Stripe."
            : ""}
        </p>
        {notice ? <p className="dx-callout">{notice}</p> : null}
      </section>

      {/* ---------------------------------------------------------------- campaigns */}
      <section className="panel" id="campaigns">
        <p className="dx-label">Live group orders</p>
        {live.length === 0 ? (
          <p className="dx-note">
            No group order is open. Members, Operate /buy, and the public campaigns API stay empty until you open one
            below.
          </p>
        ) : (
          <div>
            {live.map(({ campaign, progress, vendor, group }) => (
              <p className="dx-row" key={campaign.id}>
                <span>
                  <b>{campaign.title}</b>
                  <span className="dx-note">
                    {" "}
                    {group?.name} · {vendor?.name} · {campaign.slug}
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
        {drafts.length > 0 ? (
          <div>
            <p className="dx-label">Not open yet</p>
            {drafts.map(({ campaign, vendor, group }) => (
              <p className="dx-row" key={campaign.id}>
                <span>
                  <b>{campaign.title}</b>
                  <span className="dx-note">
                    {" "}
                    {group?.name} · {vendor?.name} · {campaign.slug}
                  </span>
                </span>
                <span className="dx-note">{campaign.min_units} unit threshold</span>
                <OpenCampaignButton campaignId={campaign.id} />
              </p>
            ))}
          </div>
        ) : null}
        <p className="dx-label" id="open-campaign">
          Open a group order
        </p>
        <p className="dx-note">
          Pick a vendor, a buying group, a unit threshold, and at least one SKU. Opening it is what Operate /buy reads.
          Drop-ship only works for a vendor marked as shipping to members.
        </p>
        <CampaignForm
          vendors={vendors.map((vendor) => ({
            slug: vendor.slug,
            name: vendor.name,
            kind: vendor.kind,
            ships_to_member_addresses: vendor.ships_to_member_addresses
          }))}
          groups={groups.map((group) => ({ slug: group.slug, name: group.name, kind: group.kind }))}
        />
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
        {dropShip.length === 0 ? (
          <p className="dx-note">None yet. Add a vendor below and mark that it ships to each member.</p>
        ) : (
          dropShip.map((vendor) => (
            <p className="dx-row" key={vendor.id}>
              <VendorIdentity vendor={vendor} />
              <span className="dx-note">{vendor.discount_summary}</span>
              <span className={readVendorPayout(vendor).payoutsEnabled ? "dx-tag" : "dx-tag dx-tag--alert"}>
                {payoutLabel(vendor)}
              </span>
              <VendorConnectButton
                vendorId={vendor.id}
                ready={readVendorPayout(vendor).payoutsEnabled}
                started={Boolean(readVendorPayout(vendor).accountId)}
              />
              <span className={vendor.status === "active" ? "dx-tag" : "dx-tag dx-tag--alert"}>{vendor.status}</span>
              <a className="dx-tag" href={`/buying-group?editVendor=${vendor.id}#vendor-form`}>
                Edit
              </a>
            </p>
          ))
        )}
      </section>

      <section className="panel">
        <p className="dx-label">Group purchasing organizations ({gpos.length})</p>
        <p className="dx-note">
          A GPO doesn&rsquo;t ship anything — it unlocks contract pricing at suppliers we already use. Joining one is
          the cheapest way to raise the whole network&rsquo;s buying power, and several charge nothing.
        </p>
        {gpos.length === 0 ? (
          <p className="dx-note">No GPO yet. Add one below and set the kind to group purchasing organization.</p>
        ) : (
          gpos.map((vendor) => (
            <p className="dx-row" key={vendor.id}>
              <VendorIdentity vendor={vendor} />
              <span className="dx-note">
                {[(vendor.eligibility || []).join(", "), vendor.discount_summary].filter(Boolean).join(" · ")}
              </span>
              <span className={vendor.status === "active" ? "dx-tag" : "dx-tag dx-tag--alert"}>{vendor.status}</span>
              <a className="dx-tag" href={`/buying-group?editVendor=${vendor.id}#vendor-form`}>
                Edit
              </a>
            </p>
          ))
        )}
      </section>

      {otherVendors.length > 0 ? (
        <section className="panel">
          <p className="dx-label">Other vendors ({otherVendors.length})</p>
          <p className="dx-note">
            Distributors, retailers, manufacturers, and the rest. They can supply a ship-to-group or pickup campaign.
            Mark “ships to each member” when you have confirmed drop-ship.
          </p>
          {otherVendors.map((vendor) => (
            <p className="dx-row" key={vendor.id}>
              <VendorIdentity vendor={vendor} />
              <span className="dx-note">{vendor.discount_summary}</span>
              <span className={vendor.status === "active" ? "dx-tag" : "dx-tag dx-tag--alert"}>{vendor.status}</span>
              <a className="dx-tag" href={`/buying-group?editVendor=${vendor.id}#vendor-form`}>
                Edit
              </a>
            </p>
          ))}
        </section>
      ) : null}

      <section className="panel" id="vendor-form">
        <p className="dx-label">{editing ? `Editing ${editing.name}` : "Add a vendor or GPO"}</p>
        <p className="dx-note">
          This writes the existing vendor list. Kind chooses GPO versus a supplier. Stripe Connect stays on the
          drop-ship rows above — it invites a vendor who will actually be paid.
        </p>
        <VendorForm key={editing?.id || "new"} vendor={editing} />
      </section>

      {/* ---------------------------------------------------------------- groups */}
      <section className="panel">
        <p className="dx-label">Buying groups ({groups.length})</p>
        {groups.length === 0 ? (
          <p className="dx-note">
            No buying group yet. A group is a church, neighborhood, club, or association whose members&rsquo; orders
            pool together. Register one in the campaign form above — a campaign cannot open without one.
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
