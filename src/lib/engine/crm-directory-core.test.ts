import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
    assert.equal(row?.tierLabel, "Top AVL tier");
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
    const design = filterDirectoryRows(directoryPreviewRows(), { ...emptyDirectoryQuery(), stage: "design" });
    assert.deepEqual(design.map((row) => row.name), ["The Fountain Church"]);
    assert.equal(design[0].state, "GA");
    assert.equal(JSON.stringify(directoryPreviewRows()).includes("Messenger AVL"), false);
    assert.equal(JSON.stringify(directoryPreviewRows()).toLowerCase().includes("existing avl talks"), false);
  });
});
