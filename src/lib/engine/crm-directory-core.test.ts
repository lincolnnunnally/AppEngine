import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { realIsoDay, storedServiceProvider } from "./lpl-crm-core.ts";
import {
  directoryPreviewRows,
  directoryQueryFromParams,
  directoryRpcArgs,
  directoryRowFromRecord,
  directoryStatusLabel,
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
});
