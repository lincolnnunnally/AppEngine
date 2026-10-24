import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  directoryPreviewRows,
  directoryQueryFromParams,
  directoryRestQuery,
  directoryRowFromRecord,
  directoryStatusLabel,
  emptyDirectoryQuery,
  filterDirectoryRows,
  encodeDirectoryCursor,
  decodeDirectoryCursor
} from "./crm-directory-core.ts";

describe("church directory pages", () => {
  it("uses the primary key for the first page and never an offset", () => {
    const query = directoryRestQuery(emptyDirectoryQuery(), null, 41);
    assert.match(query, /order=id\.asc/);
    assert.match(query, /limit=41/);
    assert.doesNotMatch(query, /offset=/);
  });

  it("continues with id=gt and keeps the filters", () => {
    const cursor = decodeDirectoryCursor(encodeDirectoryCursor({ sort: "id", dir: "asc", id: "church-9", value: "", tier: "", nulls: false }));
    assert.ok(cursor);
    const query = directoryRestQuery({ ...emptyDirectoryQuery(), state: "GA", status: "not_contacted" }, cursor, 41);
    assert.match(query, /id=gt\.church-9/);
    assert.match(query, /doc->>state\.eq\.GA/);
    assert.match(query, /crm_status\.is\.null/);
    assert.doesNotMatch(query, /offset=/);
  });

  it("shows a blank status as Not contacted and keeps a stored status", () => {
    assert.equal(directoryStatusLabel(""), "Not contacted");
    assert.equal(directoryStatusLabel("new"), "New");
    const row = directoryRowFromRecord({ id: "a", name: "Grace", crm_status: "", lead_class: "campaign_planning", jev_avl_fit: "3.5" });
    assert.equal(row?.statusLabel, "Not contacted");
    assert.equal(row?.tier, "top");
    assert.equal(row?.tierLabel, "Top AVL tier");
    assert.equal(row?.jevAvlFit, 3.5);
  });

  it("reads filters from the page query", () => {
    const query = directoryQueryFromParams({ q: "31061", state: "Georgia", tier: "second", staff: "1", fit: "2", sort: "fit", dir: "desc" });
    assert.equal(query.q, "31061");
    assert.equal(query.state, "GA");
    assert.equal(query.tier, "second");
    assert.equal(query.staff, true);
    assert.equal(query.fitMin, 2);
    assert.equal(query.sort, "fit");
    assert.equal(query.dir, "desc");
    const rest = directoryRestQuery(query, null, 40);
    assert.match(rest, /zip_code\.eq\.31061/);
    assert.match(rest, /lead_class=eq\.under_construction/);
    assert.match(rest, /jev_avl_fit=gte\.2/);
    assert.match(rest, /order=doc->>jev_avl_fit\.desc/);
    assert.doesNotMatch(rest, /offset=/);
  });

  it("filters the preview fixture the same way the form does", () => {
    const georgia = filterDirectoryRows(directoryPreviewRows(), { ...emptyDirectoryQuery(), state: "GA" });
    assert.ok(georgia.every((row) => row.state === "GA"));
    assert.equal(georgia.some((row) => row.state === "FL"), false);
    const zip = filterDirectoryRows(directoryPreviewRows(), { ...emptyDirectoryQuery(), q: "31061" });
    assert.deepEqual(zip.map((row) => row.name), ["Northridge Christian"]);
  });
});
