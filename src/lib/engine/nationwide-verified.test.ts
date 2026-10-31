import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { churchSignalLeadBody, parseTechDirectorCsv, planTechDirectorImport, type DirectoryChurch } from "./tech-director.ts";
import { NATIONWIDE_SOURCE_TAG, adaptVerifiedNationwideCsv, importerContactTags, nationwideChildArgs } from "./nationwide-verified.ts";

const fixture = readFileSync(new URL("../../../scripts/fixtures/nationwide-verified-sample.csv", import.meta.url), "utf8");

describe("nationwide verified adapter", () => {
  it("maps ready rows onto importer columns and skips do_not_use, not ready, and skip", () => {
    const adapted = adaptVerifiedNationwideCsv(fixture);
    assert.equal(adapted.ok, true);
    if (!adapted.ok) return;
    assert.equal(adapted.inputRows, 7);
    assert.equal(adapted.readyRows, 4);
    assert.equal(adapted.skipped.doNotUse, 1);
    assert.equal(adapted.skipped.notReady, 1);
    assert.equal(adapted.skipped.skipFit, 1);
    assert.equal(adapted.csv.includes("estimated_size"), false);
    assert.equal(adapted.csv.includes("avg_attendance"), false);
    assert.equal(adapted.csv.includes("1800"), false);
    assert.equal(adapted.csv.includes("josh@"), false);
    assert.equal(adapted.csv.includes("do_not_use"), false);
    const parsed = parseTechDirectorCsv(adapted.csv);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const circle = parsed.rows[0];
    assert.equal(circle.church, "3Circle Church");
    assert.equal(circle.church_id, "bb4a3bf3-278e-5f4e-925f-cf8cfa000089");
    assert.equal(circle.name, "Andrew Example");
    assert.equal(circle.contact.includes("andrew@3circlechurch.example"), true);
    assert.equal(circle.contact.includes("2519903112"), true);
    assert.equal(circle.website, "http://www.3circlechurch.com/");
    assert.equal(circle.staff_page_url, "https://3circlechurch.com/staff/");
    assert.equal(circle.signal_types, "staff");
    assert.equal(circle.signal_date, "2026-10-31");
    assert.equal(circle.score, "5");
    assert.equal(circle.lead_class, "staff_only");
    assert.deepEqual(circle.contact_tags.split("|"), [
      "verify:verified",
      "fit:avl_tech_media",
      "fit:uug_group_buy_avl",
      "size:large_800_plus",
      "role:strict_av",
      NATIONWIDE_SOURCE_TAG
    ]);
    const office = parsed.rows[1];
    assert.equal(office.name, "Office info@agapecf.example");
    assert.equal(office.lead_class, "");
    assert.equal(office.signal_types, "staff");
    assert.equal(office.score, "3");
    assert.equal(office.contact_tags.includes("verify:likely"), true);
    assert.equal(office.contact_tags.includes("fit:cc_pro_invite"), true);
    assert.equal(office.contact_tags.includes("size:small"), true);
    assert.equal(office.contact_tags.includes("role:office"), true);
    assert.equal(office.contact_tags.includes("Technical director"), false);
    const city = parsed.rows[2];
    assert.equal(city.city, "Robinson Ave. Conway");
    assert.equal(city.church_id, "");
    assert.equal(city.lead_class, "");
    const risky = parsed.rows[3];
    assert.equal(risky.signal_types, "staff");
    assert.equal(risky.contact_tags.includes("verify:risky"), true);
  });

  it("does not invent a church, and an unmatched row keeps the tags on the lead", () => {
    const adapted = adaptVerifiedNationwideCsv(fixture);
    assert.equal(adapted.ok, true);
    if (!adapted.ok) return;
    const parsed = parseTechDirectorCsv(adapted.csv);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const plan = planTechDirectorImport(parsed.rows, []);
    assert.equal(plan.matched, 0);
    assert.equal(plan.unmatched.length, 4);
    const lead = churchSignalLeadBody(parsed.rows[2], plan.unmatched[2].reason);
    const contacts = lead.contacts as Array<{ tags?: string[]; name?: string }>;
    assert.equal(lead.kind, "church-lead");
    assert.equal(contacts[0].tags?.includes("fit:avl_tech_media"), true);
    assert.equal(contacts[0].tags?.includes("size:large_800_plus"), true);
    assert.equal(contacts[0].tags?.includes("Technical director"), false);
    assert.equal(JSON.stringify(lead).includes("1800"), false);
  });

  it("merges campaign tags onto a matched church contact", () => {
    const adapted = adaptVerifiedNationwideCsv(fixture);
    assert.equal(adapted.ok, true);
    if (!adapted.ok) return;
    const parsed = parseTechDirectorCsv(adapted.csv);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const churches: DirectoryChurch[] = [
      {
        id: "bb4a3bf3-278e-5f4e-925f-cf8cfa000089",
        name: "3Circle Church",
        churchName: "",
        city: "Fairhope",
        state: "AL",
        website: "http://www.3circlechurch.com/",
        domain: "3circlechurch.com",
        inCrm: true,
        contacts: []
      }
    ];
    const plan = planTechDirectorImport(parsed.rows, churches);
    assert.equal(plan.matched, 1);
    assert.equal(plan.unmatched.length, 3);
    assert.deepEqual(plan.additions[0].contact.tags, importerContactTags({
      verify_status: "verified",
      campaign_fit: "avl_tech_media;uug_group_buy_avl",
      size_band: "large_800_plus",
      role_class: "strict_av"
    }));
  });

  it("forwards apply flags and does not add --yes on its own", () => {
    const args = nationwideChildArgs(["--apply", "--allow-production", "--report", "out.csv", "large.csv"], "/tmp/converted.csv");
    assert.deepEqual(args, ["--apply", "--allow-production", "--report", "out.csv", "/tmp/converted.csv"]);
    assert.equal(args.includes("--yes"), false);
    const yes = nationwideChildArgs(["--apply", "--yes", "--out", "keep.csv", "large.csv"], "/tmp/converted.csv");
    assert.deepEqual(yes, ["--apply", "--yes", "/tmp/converted.csv"]);
  });
});
