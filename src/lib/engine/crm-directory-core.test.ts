import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { realIsoDay, storedServiceProvider } from "./lpl-crm-core.ts";
import {
  cardMatchesContactTagFilter,
  directoryContactTagFilter,
  directoryHref,
  directoryPreviewRows,
  directoryQueryFromParams,
  directoryRpcArgs,
  directoryRowFromRecord,
  directoryStatusLabel,
  churchLeadTagPath,
  directoryTagChurchPath,
  emptyDirectoryQuery,
  filterDirectoryRows,
  pageDirectoryRaw,
  encodeDirectoryCursor,
  decodeDirectoryCursor
} from "./crm-directory-core.ts";

describe("church directory pages", () => {
  it("asks the directory function for the first page and never an offset", () => {
    const args = directoryRpcArgs(emptyDirectoryQuery(), null, 41);
    assert.equal(args.p_sort, "id");
    assert.equal(args.p_dir, "asc");
    assert.equal(args.p_limit, 41);
    assert.equal(args.p_cursor_id, "");
    assert.equal(JSON.stringify(args).includes("offset"), false);
  });

  it("continues from the raw id and keeps state and status", () => {
    const cursor = decodeDirectoryCursor(encodeDirectoryCursor({ sort: "id", dir: "asc", id: "church-9", value: "", tier: "", nulls: false }));
    assert.ok(cursor);
    const args = directoryRpcArgs({ ...emptyDirectoryQuery(), state: "GA", status: "not_contacted" }, cursor, 41);
    assert.equal(args.p_cursor_id, "church-9");
    assert.equal(args.p_state, "GA");
    assert.equal(args.p_status, "not_contacted");
    assert.equal(JSON.stringify(args).includes("Georgia"), false);
    assert.equal(JSON.stringify(args).includes("offset"), false);
  });

  it("shows a blank status as Not contacted and keeps a stored status", () => {
    assert.equal(directoryStatusLabel(""), "Not contacted");
    assert.equal(directoryStatusLabel("new"), "New");
    const row = directoryRowFromRecord({ id: "a", name: "Grace", crm_status: "", lead_class: "campaign_planning", jev_avl_fit: "3.5" });
    assert.equal(row?.statusLabel, "Not contacted");
    assert.equal(row?.tier, "top");
    assert.equal(row?.tierLabel, "Top tier");
    assert.equal(row?.jevAvlFit, 3.5);
    assert.equal(row?.existingAvlTalks, false);
  });

  it("reads filters from the page query, including building stage and numeric fit", () => {
    const query = directoryQueryFromParams({
      q: "31061",
      state: "Georgia",
      tier: "second",
      staff: "1",
      fit: "2",
      sort: "fit",
      dir: "desc",
      stage: "design"
    });
    assert.equal(query.q, "31061");
    assert.equal(query.state, "GA");
    assert.equal(query.tier, "second");
    assert.equal(query.staff, true);
    assert.equal(query.fitMin, 2);
    assert.equal(query.sort, "fit");
    assert.equal(query.dir, "desc");
    assert.equal(query.stage, "design");
    const args = directoryRpcArgs(query, null, 40);
    assert.equal(args.p_q, "31061");
    assert.equal(args.p_lead_class, "under_construction");
    assert.equal(args.p_fit_min, 2);
    assert.equal(args.p_sort, "fit");
    assert.equal(args.p_dir, "desc");
    assert.equal(args.p_building_stage, "design");
    assert.equal(args.p_staff, true);
    assert.equal(args.p_opportunity, "");
    assert.equal(JSON.stringify(args).includes("offset"), false);
  });

  it("advances the cursor from the last raw row when a merged row is dropped", () => {
    const raw = Array.from({ length: 41 }, (_, index) => ({
      id: `id-${String(index + 1).padStart(3, "0")}`,
      name: `Church ${index + 1}`,
      merged_into: index === 5 ? "other" : ""
    }));
    const page = pageDirectoryRaw(raw, emptyDirectoryQuery());
    assert.equal(page.rows.length, 39);
    assert.equal(page.rows.some((row) => row.id === "id-006"), false);
    assert.equal(page.next?.id, "id-040");
  });

  it("filters the preview fixture the same way the form does", () => {
    const georgia = filterDirectoryRows(directoryPreviewRows(), { ...emptyDirectoryQuery(), state: "GA" });
    assert.ok(georgia.every((row) => row.state === "GA"));
    assert.equal(georgia.some((row) => row.state === "FL"), false);
    const zip = filterDirectoryRows(directoryPreviewRows(), { ...emptyDirectoryQuery(), q: "31061" });
    assert.deepEqual(zip.map((row) => row.name), ["Northridge Christian"]);
    const north = zip[0];
    assert.equal(north.statusLabel, "Not contacted");
    assert.equal(north.crmStatus, "");
    assert.equal(north.avlExistingRelationship, true);
    assert.equal(north.avlProjectStatus, "avl_already_engaged");
    assert.equal(north.existingAvlTalks, true);
    assert.equal(north.providers.av.providerType, "vendor");
    assert.equal(north.providers.av.vendorName, "Messenger AVL");
    assert.equal(north.name.includes("Messenger"), false);
    const design = filterDirectoryRows(directoryPreviewRows(), { ...emptyDirectoryQuery(), stage: "design" });
    assert.deepEqual(design.map((row) => row.name), ["The Fountain Church"]);
    assert.equal(design[0].state, "GA");
    assert.equal(JSON.stringify(directoryPreviewRows().map((row) => row.name)).includes("Messenger AVL"), false);
    assert.equal(JSON.stringify(directoryPreviewRows()).toLowerCase().includes("existing avl talks"), false);
    assert.equal(JSON.stringify(directoryPreviewRows()).toLowerCase().includes("operate"), false);
    const onVendor = filterDirectoryRows(directoryPreviewRows(), { ...emptyDirectoryQuery(), vendor: "Messenger AVL", opening: "website" });
    assert.deepEqual(onVendor.map((row) => row.name), ["Northridge Christian"]);
    const served = filterDirectoryRows(directoryPreviewRows(), { ...emptyDirectoryQuery(), servedByOther: "av" });
    assert.deepEqual(served.map((row) => row.name), ["Northridge Christian"]);
    const unknownAv = filterDirectoryRows(directoryPreviewRows(), { ...emptyDirectoryQuery(), provider: "av:unknown" });
    assert.equal(unknownAv.some((row) => row.name === "Northridge Christian"), false);
    assert.equal(unknownAv.some((row) => row.name === "River Services Church"), true);
    const website = filterDirectoryRows(directoryPreviewRows(), { ...emptyDirectoryQuery(), opportunity: "website:possible" });
    assert.deepEqual(website.map((row) => row.name), ["River Services Church"]);
    assert.equal(website[0].opportunities.churchconnect.status, "possible");
    assert.equal(website[0].opportunities.laser.status, "possible");
    assert.equal(website[0].opportunities.toner.status, "unknown");
    assert.equal(realIsoDay("2026-02-31"), "");
    assert.equal(realIsoDay("2026-04-31"), "");
    assert.equal(storedServiceProvider({ av: { provider_type: "us", learned_at: "2026-10-01" } }, "av")?.learnedAt, "2026-10-01");
    assert.equal(storedServiceProvider({ av: { provider_type: "us", learned_at: "2026-02-31" } }, "av")?.learnedAt, "");
  });

  it("pre-fills opportunities from the lead class and a ChurchConnect customer, and keeps a saved status", () => {
    const other = directoryRowFromRecord({ id: "a", name: "River", lead_class: "other_services" });
    assert.equal(other?.opportunities.website.status, "possible");
    assert.equal(other?.opportunities.laser.status, "possible");
    assert.equal(other?.opportunities.churchconnect.status, "possible");
    assert.equal(other?.opportunities.toner.status, "unknown");
    assert.equal(other?.opportunities.local_mission.status, "unknown");
    const customer = directoryRowFromRecord({ id: "b", name: "On file", lead_class: "other_services", is_customer: "true" });
    assert.equal(customer?.opportunities.churchconnect.status, "active_customer");
    assert.equal(customer?.opportunities.website.status, "possible");
    const kept = directoryRowFromRecord({
      id: "c",
      name: "Kept",
      lead_class: "other_services",
      is_customer: true,
      service_opportunities: {
        churchconnect: { status: "not_a_fit", note: "They said no", updated_at: "2026-01-02" },
        operate: { status: "possible", note: "no" }
      }
    });
    assert.equal(kept?.opportunities.churchconnect.status, "not_a_fit");
    assert.equal(kept?.opportunities.churchconnect.note, "They said no");
    assert.equal(kept?.opportunities.churchconnect.updatedAt, "2026-01-02");
    assert.equal(kept?.opportunities.website.status, "possible");
    assert.equal(JSON.stringify(kept?.opportunities).includes("operate"), false);
    const query = directoryQueryFromParams({ opp: "Website: Possible" });
    assert.equal(query.opportunity, "website:possible");
    assert.equal(directoryQueryFromParams({ opp: "operate:possible" }).opportunity, "");
    assert.equal(directoryRpcArgs(query, null, 41).p_opportunity, "website:possible");
  });

  it("filters campaign fit and size from contact tags and leaves AVL fit on fit", () => {
    const query = directoryQueryFromParams({
      campaign_fit: "avl_tech_media,uug_group_buy_avl",
      size: "large_800_plus",
      verify: "verified,likely",
      q: "fit:avl_tech_media"
    });
    assert.equal(directoryQueryFromParams({ fit: "2" }).fitMin, 2);
    assert.equal(directoryQueryFromParams({ fit: "2" }).campaignFit, "");
    assert.equal(query.campaignFit, "avl_tech_media,uug_group_buy_avl");
    assert.equal(query.sizeBand, "large_800_plus");
    assert.deepEqual(directoryContactTagFilter(query).fit, ["fit:avl_tech_media", "fit:uug_group_buy_avl"]);
    assert.deepEqual(directoryContactTagFilter(query).verify, ["verify:verified", "verify:likely"]);
    const tagged = directoryRowFromRecord({
      id: "circle",
      name: "3Circle Church",
      city: "Fairhope",
      state: "AL",
      staff_contacts: [{ name: "Andrew Example", tags: ["verify:verified", "fit:avl_tech_media", "fit:uug_group_buy_avl", "size:large_800_plus", "role:strict_av", "src:nationwide-20261031"] }]
    });
    const office = directoryRowFromRecord({
      id: "agape",
      name: "Agape Christian Fellowship",
      city: "Alexandria",
      state: "Alabama",
      staff_contacts: [{ name: "Office info@agapecf.example", tags: ["verify:likely", "fit:cc_pro_invite", "size:small", "role:office", "src:nationwide-20261031"] }]
    });
    assert.ok(tagged && office);
    const rows = [tagged, office];
    assert.deepEqual(filterDirectoryRows(rows, query).map((row) => row.id), ["circle"]);
    const either = filterDirectoryRows(rows, { ...emptyDirectoryQuery(), verify: "verified,likely" });
    assert.deepEqual(either.map((row) => row.id), ["circle", "agape"]);
    const small = filterDirectoryRows(rows, { ...emptyDirectoryQuery(), size: "small", campaignFit: "cc_pro_invite" });
    assert.deepEqual(small.map((row) => row.id), ["agape"]);
    const byTag = filterDirectoryRows(rows, { ...emptyDirectoryQuery(), q: "fit:cc_pro_invite" });
    assert.deepEqual(byTag.map((row) => row.name), ["Agape Christian Fellowship"]);
    const alabama = filterDirectoryRows(rows, { ...emptyDirectoryQuery(), state: "AL", q: "src:nationwide-20261031" });
    assert.equal(alabama.length, 2);
    assert.equal(cardMatchesContactTagFilter({ contacts: [{ tags: ["fit:avl_tech_media", "verify:verified"] }] }, directoryContactTagFilter({ q: "", campaignFit: "avl_tech_media", sizeBand: "", verifyStatus: "verified" })), true);
    assert.equal(cardMatchesContactTagFilter({ contacts: [{ tags: ["fit:cc_pro_invite"] }] }, directoryContactTagFilter({ q: "", campaignFit: "avl_tech_media", sizeBand: "", verifyStatus: "" })), false);
    const href = directoryHref({ ...emptyDirectoryQuery(), campaignFit: "avl_tech_media", sizeBand: "large_800_plus", verifyStatus: "verified", state: "AL" });
    assert.equal(href.includes("campaign_fit=avl_tech_media"), true);
    assert.equal(href.includes("size=large_800_plus"), true);
    assert.equal(href.includes("verify=verified"), true);
    assert.equal(/[?&]fit=/.test(href), false);
    const path = directoryTagChurchPath({ ...emptyDirectoryQuery(), campaignFit: "avl_tech_media", state: "AL" }, "church-1", 41);
    assert.ok(path);
    assert.equal(path?.startsWith("cc_churches?"), true);
    assert.equal(path?.includes("doc=cs."), true);
    assert.equal(path?.includes("staff_contacts.ilike"), false);
    assert.equal(path?.includes("->>staff_contacts"), false);
    const contained = JSON.parse(decodeURIComponent(path?.split("doc=cs.")[1]?.split("&")[0] ?? "")) as { staff_contacts: Array<{ tags: string[] }> };
    assert.deepEqual(contained.staff_contacts[0].tags, ["fit:avl_tech_media"]);
    assert.equal(path?.includes("id=gt.church-1"), true);
    assert.equal(path?.includes("doc->>state.ilike.AL"), true);
    assert.equal(path?.includes("crm_directory_page"), false);
    const eitherPath = directoryTagChurchPath({ ...emptyDirectoryQuery(), campaignFit: "avl_tech_media", verifyStatus: "verified,likely" }, "", 40);
    assert.equal(eitherPath?.includes("contacts.ilike"), false);
    assert.equal(eitherPath?.includes("staff_contacts.ilike"), false);
    assert.equal(eitherPath?.includes('doc.cs."'), true);
    assert.equal((eitherPath?.match(/doc\.cs\./g) ?? []).length, 2);
    const leadPath = churchLeadTagPath({ ...emptyDirectoryQuery(), campaignFit: "avl_tech_media", sizeBand: "small,medium" }, 40);
    assert.equal(leadPath?.includes("contacts=cs."), false);
    assert.equal(leadPath?.includes("contacts.ilike"), false);
    assert.equal(leadPath?.includes("->>contacts"), false);
    assert.equal((leadPath?.match(/contacts\.cs\./g) ?? []).length, 2);
    assert.equal(leadPath?.includes("kind=eq.church-lead"), true);
    assert.equal(directoryTagChurchPath(emptyDirectoryQuery(), "", 41), null);
    assert.equal(churchLeadTagPath(emptyDirectoryQuery(), 40), null);
    assert.equal(JSON.stringify(directoryPreviewRows()).includes("Messenger AVL"), true);
    assert.equal(directoryPreviewRows().every((row) => row.contactTags.length === 0), true);
  });
});
