"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { notesForOperator } from "@/lib/group-buy/operator-input";
import type { VendorKind, VendorStatus } from "@/lib/group-buy/types";
import { FULFILLMENTS, GROUP_KINDS, PURCHASE_MODES, VENDOR_KINDS, VENDOR_STATUSES } from "@/lib/group-buy/types";

type VendorSeed = {
  id: string;
  slug: string;
  name: string;
  kind: VendorKind;
  website: string | null;
  join_url: string | null;
  membership_fee_cents: number;
  eligibility: string[];
  ships_to_member_addresses: boolean;
  discount_summary: string | null;
  min_order_units: number | null;
  status: VendorStatus;
  contact_email: string | null;
  notes: string | null;
};

type VendorChoice = {
  slug: string;
  name: string;
  kind: string;
  ships_to_member_addresses: boolean;
};

type GroupChoice = {
  slug: string;
  name: string;
  kind: string;
};

const KIND_LABEL: Record<string, string> = {
  gpo: "Group purchasing organization",
  distributor: "Distributor",
  retailer: "Retailer",
  manufacturer: "Manufacturer",
  marketplace: "Marketplace",
  print_on_demand: "Print on demand",
  church: "Church",
  neighborhood: "Neighborhood",
  club: "Club",
  association: "Association",
  school: "School",
  ecosystem: "Ecosystem",
  other: "Other",
  member_benefit: "Members buy for themselves",
  org_use: "The organization buys for its own use",
  drop_ship_member: "Vendor ships to each member",
  ship_to_group: "Ship to the group",
  pickup: "Pickup"
};

function label(value: string) {
  return KIND_LABEL[value] || value;
}

async function readJson(response: Response) {
  const data = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; detail?: string } | null;
  return data;
}

function failure(data: { message?: string; detail?: string } | null, fallback: string) {
  if (!data?.message) return fallback;
  return data.detail ? `${data.message} ${data.detail}` : data.message;
}

export function VendorForm({ vendor }: { vendor: VendorSeed | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/group-buy/vendors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save",
          id: vendor?.id,
          name: form.get("name"),
          slug: form.get("slug"),
          kind: form.get("kind"),
          status: form.get("status"),
          website: form.get("website"),
          join_url: form.get("join_url"),
          ships_to_member_addresses: form.get("ships_to_member_addresses") === "on",
          discount_summary: form.get("discount_summary"),
          membership_fee: form.get("membership_fee"),
          min_order_units: form.get("min_order_units"),
          eligibility: form.get("eligibility"),
          contact_email: form.get("contact_email"),
          notes: form.get("notes")
        })
      });
      const data = await readJson(response);

      if (!response.ok || !data?.ok) {
        setError(failure(data, "Could not save the vendor."));
        return;
      }

      router.replace("/buying-group?notice=vendor-saved#vendors");
      router.refresh();
    } catch {
      setError("Could not reach the vendor desk.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        Name
        <input className="convo-input" name="name" required defaultValue={vendor?.name || ""} placeholder="Vendor or GPO name" />
      </label>
      <label>
        Slug
        <input className="convo-input" name="slug" defaultValue={vendor?.slug || ""} placeholder="Leave blank to build it from the name" />
      </label>
      <label>
        Kind
        <select className="convo-input" name="kind" defaultValue={vendor?.kind || "distributor"}>
          {VENDOR_KINDS.map((kind) => (
            <option value={kind} key={kind}>
              {label(kind)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select className="convo-input" name="status" defaultValue={vendor?.status || "active"}>
          {VENDOR_STATUSES.map((status) => (
            <option value={status} key={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label>
        Website
        <input className="convo-input" name="website" type="text" defaultValue={vendor?.website || ""} placeholder="https://" />
      </label>
      <label>
        Join link
        <input className="convo-input" name="join_url" type="text" defaultValue={vendor?.join_url || ""} placeholder="Where a group applies, if this is a GPO" />
      </label>
      <label>
        Membership fee (dollars)
        <input
          className="convo-input"
          name="membership_fee"
          inputMode="decimal"
          defaultValue={vendor ? (vendor.membership_fee_cents / 100).toFixed(2) : "0"}
          placeholder="0.00"
        />
      </label>
      <label>
        Minimum units
        <input className="convo-input" name="min_order_units" inputMode="numeric" defaultValue={vendor?.min_order_units ?? ""} />
      </label>
      <label>
        Who can join
        <input
          className="convo-input"
          name="eligibility"
          defaultValue={(vendor?.eligibility || []).join(", ")}
          placeholder="churches, nonprofits"
        />
      </label>
      <label>
        Contact email
        <input className="convo-input" name="contact_email" type="email" defaultValue={vendor?.contact_email || ""} placeholder="Used when Stripe invites this vendor" />
      </label>
      <label>
        Discount summary
        <input className="convo-input" name="discount_summary" defaultValue={vendor?.discount_summary || ""} placeholder="What the bulk price looks like" />
      </label>
      <label>
        Notes
        <input className="convo-input" name="notes" defaultValue={notesForOperator(vendor?.notes)} />
      </label>
      <label className="spark-checkbox" style={{ gridColumn: "1 / -1" }}>
        <input name="ships_to_member_addresses" type="checkbox" defaultChecked={vendor?.ships_to_member_addresses || false} />
        <span>Ships to each member address. Required before a drop-ship campaign can open against this vendor.</span>
      </label>
      {error ? (
        <p className="dx-note" role="alert" style={{ gridColumn: "1 / -1" }}>
          {error}
        </p>
      ) : null}
      <div className="action-row" style={{ gridColumn: "1 / -1" }}>
        <button className="dx-btn dx-btn--primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : vendor ? "Save vendor" : "Add vendor"}
        </button>
        {vendor ? (
          <a className="account-link" href="/buying-group#vendor-form">
            Cancel — add a different vendor
          </a>
        ) : null}
      </div>
    </form>
  );
}

export function CampaignForm({ vendors, groups }: { vendors: VendorChoice[]; groups: GroupChoice[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupChoice, setGroupChoice] = useState(groups[0]?.slug || "__new__");
  const [items, setItems] = useState([
    { sku: "", name: "", list_price: "", unit_price: "" },
    { sku: "", name: "", list_price: "", unit_price: "" },
    { sku: "", name: "", list_price: "", unit_price: "" }
  ]);

  if (vendors.length === 0) {
    return (
      <p className="dx-note">
        Add a vendor in the section below first. A campaign buys from a vendor already on this desk.
      </p>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const open = form.get("open") === "on";
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/group-buy/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          group: groupChoice === "__new__" ? "" : groupChoice,
          group_name: groupChoice === "__new__" ? form.get("group_name") : "",
          group_kind: form.get("group_kind"),
          new_group_slug: groupChoice === "__new__" ? form.get("new_group_slug") : "",
          vendor: form.get("vendor"),
          title: form.get("title"),
          slug: form.get("slug"),
          description: form.get("description"),
          min_units: form.get("min_units"),
          purchase_mode: form.get("purchase_mode"),
          fulfillment: form.get("fulfillment"),
          commission_percent: form.get("commission_percent"),
          closes_at: form.get("closes_at"),
          open,
          items
        })
      });
      const data = await readJson(response);

      if (!response.ok || !data?.ok) {
        setError(failure(data, "Could not save the campaign."));
        return;
      }

      router.replace(`/buying-group?notice=${open ? "campaign-open" : "campaign-draft"}#campaigns`);
      router.refresh();
    } catch {
      setError("Could not reach the campaign desk.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        Vendor
        <select className="convo-input" name="vendor" required defaultValue={vendors.find((row) => row.ships_to_member_addresses)?.slug || vendors[0].slug}>
          {vendors.map((vendor) => (
            <option value={vendor.slug} key={vendor.slug}>
              {vendor.name} · {label(vendor.kind)}
              {vendor.ships_to_member_addresses ? " · ships to members" : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        Buying group
        <select className="convo-input" name="group" value={groupChoice} onChange={(event) => setGroupChoice(event.target.value)}>
          {groups.map((group) => (
            <option value={group.slug} key={group.slug}>
              {group.name} · {label(group.kind)}
            </option>
          ))}
          <option value="__new__">Register a new buying group</option>
        </select>
      </label>
      {groupChoice === "__new__" ? (
        <>
          <label>
            New group name
            <input className="convo-input" name="group_name" required placeholder="Vidalia churches" />
          </label>
          <label>
            New group slug
            <input className="convo-input" name="new_group_slug" placeholder="Leave blank to build it from the name" />
          </label>
          <label>
            New group kind
            <select className="convo-input" name="group_kind" defaultValue="church">
              {GROUP_KINDS.map((kind) => (
                <option value={kind} key={kind}>
                  {label(kind)}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
      <label>
        Campaign title
        <input className="convo-input" name="title" required placeholder="What the group is buying" />
      </label>
      <label>
        Slug
        <input className="convo-input" name="slug" placeholder="Leave blank to build it from the title. This is the public /buy path." />
      </label>
      <label>
        Unit threshold
        <input className="convo-input" name="min_units" required inputMode="numeric" min={1} placeholder="How many units open the bulk price" />
      </label>
      <label>
        United Under God commission (%)
        <input className="convo-input" name="commission_percent" inputMode="decimal" placeholder="0" />
      </label>
      <label>
        Fulfillment
        <select className="convo-input" name="fulfillment" defaultValue="drop_ship_member">
          {FULFILLMENTS.map((mode) => (
            <option value={mode} key={mode}>
              {label(mode)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Who the goods are for
        <select className="convo-input" name="purchase_mode" defaultValue="member_benefit">
          {PURCHASE_MODES.map((mode) => (
            <option value={mode} key={mode}>
              {label(mode)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Closes
        <input className="convo-input" name="closes_at" type="datetime-local" />
      </label>
      <label>
        Description
        <input className="convo-input" name="description" placeholder="Optional. Members see this on the buy sheet." />
      </label>
      <div style={{ gridColumn: "1 / -1" }}>
        <p className="dx-label">SKUs</p>
        <p className="dx-note">List price is the shelf price. Group price is what a member pays before a later tier improves it. Blank rows are skipped.</p>
        {items.map((item, index) => (
          <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
            <label>
              SKU
              <input
                className="convo-input"
                value={item.sku}
                onChange={(event) => setItems((rows) => rows.map((row, i) => (i === index ? { ...row, sku: event.target.value } : row)))}
              />
            </label>
            <label>
              Name
              <input
                className="convo-input"
                value={item.name}
                onChange={(event) => setItems((rows) => rows.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))}
              />
            </label>
            <label>
              List price (dollars)
              <input
                className="convo-input"
                inputMode="decimal"
                value={item.list_price}
                onChange={(event) => setItems((rows) => rows.map((row, i) => (i === index ? { ...row, list_price: event.target.value } : row)))}
              />
            </label>
            <label>
              Group price (dollars)
              <input
                className="convo-input"
                inputMode="decimal"
                value={item.unit_price}
                onChange={(event) => setItems((rows) => rows.map((row, i) => (i === index ? { ...row, unit_price: event.target.value } : row)))}
              />
            </label>
          </div>
        ))}
      </div>
      <label className="spark-checkbox" style={{ gridColumn: "1 / -1" }}>
        <input name="open" type="checkbox" defaultChecked />
        <span>Open it now, so Operate /buy and the public campaigns API can list it.</span>
      </label>
      {error ? (
        <p className="dx-note" role="alert" style={{ gridColumn: "1 / -1" }}>
          {error}
        </p>
      ) : null}
      <div className="action-row" style={{ gridColumn: "1 / -1" }}>
        <button className="dx-btn dx-btn--primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save campaign"}
        </button>
      </div>
    </form>
  );
}

export function OpenCampaignButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/group-buy/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId, status: "open" })
      });
      const data = await readJson(response);

      if (!response.ok || !data?.ok) {
        setError(failure(data, "Could not open the campaign."));
        return;
      }

      router.replace("/buying-group?notice=campaign-open#campaigns");
      router.refresh();
    } catch {
      setError("Could not reach the campaign desk.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button className="dx-tag" type="button" onClick={open} disabled={busy}>
        {busy ? "Opening…" : "Open campaign →"}
      </button>
      {error ? <span className="dx-note"> {error}</span> : null}
    </span>
  );
}
