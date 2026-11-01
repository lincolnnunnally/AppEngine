import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { churchLeadInQueue } from "./lpl-crm-core.ts";
import {
  AVL_REFERRAL_FIT_TAG,
  AVL_REFERRAL_KIND,
  avlReferralActivity,
  avlReferralLeadBody,
  avlReferralSlug,
  formatAvlReferralSummary,
  planAvlReferralImport,
  referralRoleTags
} from "./avl-referral.ts";
import { mergeChurchSignalContacts } from "./tech-director.ts";

const fixture = readFileSync(new URL("../../../scripts/fixtures/avl-referrals-sample.csv", import.meta.url), "utf8");

describe("avl referral import", () => {
  it("maps builder, architect, design-build, and capital campaign onto field leads", () => {
    assert.deepEqual(referralRoleTags("builder"), ["role:builder"]);
    assert.deepEqual(referralRoleTags("Architect"), ["role:architect"]);
    assert.deepEqual(referralRoleTags("design-build"), ["role:design_build"]);
    assert.deepEqual(referralRoleTags("capital_campaign_consultant"), ["role:capital_campaign_consultant"]);
    assert.deepEqual(referralRoleTags("architect / builder"), ["role:architect", "role:builder"]);
    assert.deepEqual(referralRoleTags("general contractor"), []);

    const planned = planAvlReferralImport(fixture);
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    const plan = planned.plan;
    assert.equal(plan.inputRows, 8);
    assert.equal(plan.ready, 7);
    assert.equal(plan.leads, 7);
    assert.equal(plan.skippedDoNotUse, 1);
    assert.equal(plan.skippedNoOrg, 0);
    assert.equal(plan.missingWebsite, 1);
    assert.equal(plan.missingEmail, 3);
    assert.equal(plan.missingPhone, 4);
    assert.equal(plan.churchProjectRows, 2);
    assert.equal(plan.churchesInvented, 0);
    assert.equal(plan.leadClassAvlReferral, 7);
    assert.equal(plan.roles["role:builder"], 3);
    assert.equal(plan.roles["role:architect"], 2);
    assert.equal(plan.roles["role:design_build"], 1);
    assert.equal(plan.roles["role:capital_campaign_consultant"], 1);
    assert.equal(plan.unmappedRoles, 0);
    assert.deepEqual(plan.inHouseAvl, ["Domus Studio", "Paragon 360"]);

    for (const body of plan.bodies) {
      assert.equal(body.kind, AVL_REFERRAL_KIND);
      assert.equal(body.kind, "field");
      assert.notEqual(body.kind, "church-lead");
      assert.notEqual(body.kind, "referral-partner");
      assert.equal(body.send_invite, false);
      assert.equal(JSON.stringify(body).includes("church-lead"), false);
      assert.equal(JSON.stringify(body).includes("referral-partner"), false);
      assert.equal(JSON.stringify(body).includes("provider_type"), false);
      assert.equal("church_id" in body, false);
      const contacts = body.contacts as Array<{ tags?: string[] }>;
      assert.equal(contacts[0].tags?.includes(AVL_REFERRAL_FIT_TAG), true);
      const signals = body.signals as { kind?: string; tags?: string[]; in_house_avl?: string };
      assert.equal(signals.kind, "avl-referral");
      assert.equal(signals.tags?.includes(AVL_REFERRAL_FIT_TAG), true);
      assert.equal(churchLeadInQueue(signals), false);
    }

    const summary = formatAvlReferralSummary(plan);
    assert.match(summary, /kind: field/);
    assert.match(summary, /fit:avl_referral on every ready row/);
    assert.match(summary, /churches invented: 0/);
    assert.match(summary, /church writes: 0/);
    assert.match(summary, /nothing is sent/);
    assert.match(summary, /possible in-house AVL \(not invented\): Domus Studio, Paragon 360/);
    assert.equal(summary.includes("ada@par.example"), false);
    assert.equal(summary.includes("glenn@beazley.example"), false);
    assert.equal(summary.includes("skip@example.com"), false);
    assert.equal(JSON.stringify(plan.bodies).includes("skip@example.com"), false);
  });

  it("reads type and hq columns, merges a repeat firm, and keeps the activity ref stable", () => {
    const csv = [
      "firm,type,contact_name,title,public_phone_email,website,hq_city_state,church_projects,verify_status,lead_class",
      "Van Winkle Construction,builder,Ada Example,President,2055550100 / ada@van.example,https://van.example,\"Macon, GA\",Grace Chapel,verified,avl_referral",
      "Van Winkle Construction,architect,Glenn Example,Designer,,https://van.example,\"Macon, Georgia\",,likely,avl_referral"
    ].join("\n");
    const planned = planAvlReferralImport(csv);
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    assert.equal(planned.plan.ready, 2);
    assert.equal(planned.plan.leads, 1);
    assert.equal(planned.plan.roles["role:builder"], 1);
    assert.equal(planned.plan.roles["role:architect"], 1);
    const body = planned.plan.bodies[0];
    assert.equal(body.kind, "field");
    assert.equal(body.city, "Macon");
    assert.equal(body.state, "GA");
    const contacts = body.contacts as Array<{ name?: string; tags?: string[] }>;
    assert.equal(contacts.length, 2);
    assert.equal(contacts.every((contact) => contact.tags?.includes("fit:avl_referral")), true);
    assert.equal(avlReferralSlug("Van Winkle Construction", "Macon", "GA"), avlReferralSlug("Van Winkle Construction", "Macon", "Georgia"));
    assert.notEqual(avlReferralSlug("Van Winkle Construction", "Macon", "GA"), avlReferralSlug("Van Winkle Construction", "Macon", "AL"));
    assert.match(String(body.slug), /^ar-/);
    const again = avlReferralLeadBody({
      org: "Van Winkle Construction",
      contactName: "Ada Example",
      title: "President",
      roleRaw: "builder",
      email: "ada@van.example",
      phone: "2055550100",
      website: "https://van.example",
      city: "Macon",
      state: "GA",
      zip: "",
      churchProjects: "Grace Chapel",
      sourceUrl: "",
      verifyStatus: "verified",
      leadClass: "avl_referral",
      avNote: "",
      line: 2
    });
    const merged = mergeChurchSignalContacts(body.contacts, again.contacts);
    assert.equal(merged.added, 0);
    const activity = avlReferralActivity("44444444-4444-4444-8444-444444444444", body);
    assert.equal(activity.type, "note");
    assert.equal(activity.source, "avl_referral_import");
    assert.equal(activity.outcome, "Imported as an AVL referral");
    assert.equal(avlReferralActivity("44444444-4444-4444-8444-444444444444", body).client_ref, activity.client_ref);
    assert.equal(JSON.stringify(activity).includes("ada@van.example"), false);
  });

  it("refuses a file with no org column", () => {
    const planned = planAvlReferralImport("email,phone\nada@example.com,4045550100\n");
    assert.equal(planned.ok, false);
    if (planned.ok) return;
    assert.match(planned.message, /org_name/);
  });
});
