import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isTechnicalDirector, parsePublishedContact, readChurchSignals, technicalDirectorsFromStaff } from "./tech-director-core.ts";
import {
  addChurchSignals,
  addStaffContacts,
  churchIsInCrm,
  formatImportCounts,
  matchDirectoryChurch,
  parseTechDirectorCsv,
  planTechDirectorImport,
  stampStaffContact,
  techDirectorContactId,
  type DirectoryChurch,
  type TechDirectorCsvRow
} from "./tech-director.ts";

const churches: DirectoryChurch[] = [
  { id: "g1", name: "Grace Chapel", churchName: "", city: "Vidalia", state: "GA", website: "https://gracechapel.example", domain: "", inCrm: true, contacts: [] },
  { id: "fbc", name: "First Baptist Church", churchName: "FBC Macon", city: "Macon", state: "Georgia", website: "", domain: "", inCrm: true, contacts: [] },
  { id: "s1", name: "Alpha Shared", churchName: "", city: "Savannah", state: "GA", website: "https://shared.example", domain: "", inCrm: true, contacts: [] },
  { id: "s2", name: "Beta Shared", churchName: "", city: "Savannah", state: "GA", website: "https://www.shared.example/other", domain: "", inCrm: true, contacts: [] },
  { id: "fb", name: "River Church", churchName: "", city: "Vidalia", state: "GA", website: "https://facebook.com/riverchurch", domain: "", inCrm: true, contacts: [] },
  { id: "al", name: "Hope Church", churchName: "", city: "Birmingham", state: "AL", website: "https://hopebirmingham.example", domain: "", inCrm: false, contacts: [] },
  { id: "fl", name: "Palm Chapel", churchName: "", city: "Orlando", state: "FL", website: "https://palmchapel.example", domain: "", inCrm: false, contacts: [] }
];

function row(partial: Partial<TechDirectorCsvRow> & Pick<TechDirectorCsvRow, "church" | "name">): TechDirectorCsvRow {
  return {
    city: "",
    state: "",
    website: "",
    staff_page_url: "",
    title: "",
    contact: "",
    signal_types: "staff",
    evidence_quote: "",
    source_url: "",
    signal_date: "",
    score: "1",
    line: 2,
    ...partial
  };
}

describe("technical director matching", () => {
  it("matches the website domain before the name", () => {
    const match = matchDirectoryChurch(
      row({ church: "Some Other Name", city: "Atlanta", state: "GA", website: "https://www.gracechapel.example/give", name: "Jane Doe" }),
      churches
    );
    assert.equal("church" in match && match.church.id, "g1");
  });

  it("matches name and city when the website is missing", () => {
    const match = matchDirectoryChurch(row({ church: "First Baptist Church", city: "Macon", state: "GA", name: "Chris Lee" }), churches);
    assert.equal("church" in match && match.church.id, "fbc");
  });

  it("uses name and city when the website is a shared host", () => {
    const match = matchDirectoryChurch(
      row({ church: "River Church", city: "Vidalia", website: "https://facebook.com/riverchurch", name: "Ann Poe" }),
      churches
    );
    assert.equal("church" in match && match.church.id, "fb");
  });

  it("does not pick a church when several share the website", () => {
    const match = matchDirectoryChurch(
      row({ church: "Shared Site Church", city: "Savannah", website: "https://shared.example/one", name: "Ann Poe" }),
      churches
    );
    assert.equal("reason" in match && match.reason, "Several churches share that website, and the name and city do not pick one.");
  });

  it("uses state to tell two churches apart", () => {
    const twins: DirectoryChurch[] = [
      { id: "ga", name: "Hope Church", churchName: "", city: "Macon", state: "GA", website: "", domain: "", inCrm: true, contacts: [] },
      { id: "al", name: "Hope Church", churchName: "", city: "Macon", state: "AL", website: "", domain: "", inCrm: true, contacts: [] }
    ];
    const match = matchDirectoryChurch(row({ church: "Hope Church", city: "Macon", state: "Alabama", name: "Sam" }), twins);
    assert.equal("church" in match && match.church.id, "al");
  });

  it("leaves a row unmatched when name and city hit more than one church", () => {
    const twins: DirectoryChurch[] = [
      { id: "a", name: "Hope Church", churchName: "", city: "Macon", state: "", website: "", domain: "", inCrm: true, contacts: [] },
      { id: "b", name: "Hope Church", churchName: "", city: "Macon", state: "", website: "", domain: "", inCrm: true, contacts: [] }
    ];
    const match = matchDirectoryChurch(row({ church: "Hope Church", city: "Macon", name: "Sam" }), twins);
    assert.equal("reason" in match && match.reason, "More than one church has that name and city.");
  });
});

describe("technical director dedupe", () => {
  it("plans the fixture: domain match, name match, duplicate name, and unmatched rows", () => {
    const csv = readFileSync(new URL("../../../scripts/fixtures/tech-directors.csv", import.meta.url), "utf8");
    const parsed = parseTechDirectorCsv(csv);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(
      Object.keys(parsed.rows[0]).filter((key) => key !== "line"),
      ["church", "city", "state", "website", "staff_page_url", "name", "title", "contact", "signal_types", "evidence_quote", "source_url", "signal_date", "score"]
    );
    const plan = planTechDirectorImport(parsed.rows, churches);
    assert.equal(plan.matched, 6);
    assert.equal(plan.inCrm, 4);
    assert.equal(plan.directoryOnly, 2);
    assert.equal(plan.newContacts, 2);
    assert.equal(plan.duplicatesSkipped, 1);
    assert.equal(plan.newSignals, 3);
    assert.equal(plan.signalDuplicatesSkipped, 1);
    assert.equal(plan.unmatched.length, 2);
    assert.equal(plan.byState.GA.inCrm, 4);
    assert.equal(plan.byState.GA.newContacts, 2);
    assert.equal(plan.byState.AL.directoryOnly, 1);
    assert.equal(plan.byState.AL.inCrm, 0);
    assert.equal(plan.byState.FL.directoryOnly, 1);
    assert.equal(plan.byState["(none)"].unmatched, 1);
    assert.match(formatImportCounts(plan), /directory only: 2/);
    assert.match(formatImportCounts(plan), /AL: matched 1, in CRM 0, directory only 1/);
    const building = plan.signalAdditions.find((item) => item.signal.tag === "Building investment");
    assert.ok(building);
    assert.equal(building.churchId, "g1");
    assert.equal(building.signal.evidence_quote, "The sanctuary is being renovated.");
    assert.equal(building.signal.score, 60);
    assert.equal(plan.additions.length, 2);
    assert.equal(plan.directoryOnlyRows.map((item) => item.row.church).join(","), "Hope Church,Palm Chapel");
    assert.deepEqual(
      plan.unmatched.map((item) => item.row.church),
      ["Unknown Mission", "Shared Site Church"]
    );
    const jane = plan.additions.find((item) => item.contact.name === "Jane Doe");
    const chris = plan.additions.find((item) => item.contact.name === "Chris Lee");
    assert.ok(jane);
    assert.equal(jane.churchId, "g1");
    assert.equal(jane.contact.role, "Director of Media");
    assert.deepEqual(jane.contact.tags, ["Technical director"]);
    assert.equal(jane.contact.email, "jane@gracechapel.example");
    assert.equal(jane.contact.phone, "");
    assert.equal(jane.contact.source_url, "https://gracechapel.example/staff");
    assert.equal(jane.contact.id, techDirectorContactId("g1", "Jane Doe"));
    assert.ok(chris);
    assert.equal(chris.churchId, "fbc");
    assert.equal(chris.contact.role, "Technical Director");
    assert.equal(chris.contact.phone, "(478) 555-0142");
    assert.equal(plan.additions.length, 2);
  });

  it("skips a name already stored on the church and does not invent a church", () => {
    const withJane: DirectoryChurch[] = churches.map((church) =>
      church.id === "g1" ? { ...church, contacts: [{ name: "Jane  Doe" }] } : church
    );
    const plan = planTechDirectorImport(
      [row({ church: "Grace Chapel", city: "Vidalia", state: "GA", website: "https://gracechapel.example", name: "Jane Doe", title: "Director of Media" })],
      withJane
    );
    assert.equal(plan.matched, 1);
    assert.equal(plan.newContacts, 0);
    assert.equal(plan.duplicatesSkipped, 1);
    assert.equal(plan.additions.length, 0);
    assert.equal(plan.unmatched.length, 0);
  });

  it("keeps existing contact keys and will not append the same name twice", () => {
    const merged = addStaffContacts(
      [{ id: "old", name: "Pat Jones", role: "Pastor", note: "keep me" }],
      [
        {
          id: "td-1",
          name: "Jane Doe",
          role: "Director of Media",
          email: "jane@gracechapel.example",
          phone: "",
          tags: ["Technical director"],
          source_url: "https://gracechapel.example/staff"
        },
        {
          id: "td-2",
          name: "jane doe",
          role: "Director of Media",
          email: "",
          phone: "",
          tags: ["Technical director"],
          source_url: ""
        }
      ]
    );
    assert.equal(merged.added, 1);
    assert.equal(merged.duplicates, 1);
    assert.equal(merged.staff[0].note, "keep me");
    assert.equal(merged.staff.length, 2);
    assert.equal(merged.staff[1].id, "td-1");
  });

  it("stamps the role tag and source page on the existing contact", () => {
    const stamped = stampStaffContact([{ id: "c1", name: "Jane Doe", role: "Director of Media", email: "jane@gracechapel.example" }], {
      id: "c1",
      tags: ["Technical director"],
      sourceUrl: "https://gracechapel.example/staff"
    });
    assert.equal(stamped.found, true);
    assert.deepEqual(stamped.staff[0].tags, ["Technical director"]);
    assert.equal(stamped.staff[0].source_url, "https://gracechapel.example/staff");
    assert.equal(stamped.staff[0].role, "Director of Media");
    const cleared = stampStaffContact(stamped.staff, { id: "c1", tags: [], sourceUrl: "" });
    assert.equal("tags" in cleared.staff[0], false);
    assert.equal("source_url" in cleared.staff[0], false);
  });
});

describe("technical director contact fields", () => {
  it("reads a published email and phone from one cell", () => {
    assert.deepEqual(parsePublishedContact("jane@gracechapel.example / (912) 555-0100"), {
      email: "jane@gracechapel.example",
      phone: "(912) 555-0100"
    });
  });

  it("treats the exact title as the role tag and keeps a different title until it is tagged", () => {
    assert.equal(isTechnicalDirector({ title: "Technical Director" }), true);
    assert.equal(isTechnicalDirector({ title: "Director of Media" }), false);
    assert.equal(isTechnicalDirector({ title: "Director of Media", tags: ["Technical director"] }), true);
    const people = technicalDirectorsFromStaff([
      { name: "Jane Doe", role: "Director of Media", email: "jane@gracechapel.example", phone: "(912) 555-0148", tags: ["Technical director"], source_url: "https://gracechapel.example/staff" },
      { name: "Pat Jones", role: "Pastor", email: "pat@gracechapel.example" }
    ]);
    assert.equal(people.length, 1);
    assert.equal(people[0].name, "Jane Doe");
    assert.equal(people[0].title, "Director of Media");
    assert.equal(people[0].email, "jane@gracechapel.example");
    assert.equal(people[0].phone, "(912) 555-0148");
    assert.equal(people[0].sourceUrl, "https://gracechapel.example/staff");
  });

  it("accepts a CSV without a state column", () => {
    const parsed = parseTechDirectorCsv(
      "church,city,website,staff_page_url,name,title,contact,signal_types,evidence_quote,source_url,signal_date,score\nHope,Macon,https://hope.example,https://hope.example/staff,Sam,Director,,staff,Quoted,https://hope.example/staff,2026-01-01,5\n"
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.rows[0].state, "");
    assert.equal(parsed.rows[0].name, "Sam");
  });

  it("stores a campaign on the church and does not create a person", () => {
    const plan = planTechDirectorImport(
      [
        row({
          church: "Grace Chapel",
          city: "Vidalia",
          state: "GA",
          website: "https://gracechapel.example",
          name: "Should Not Be Saved",
          signal_types: "campaign|renovation",
          evidence_quote: "Building next year.",
          source_url: "https://gracechapel.example/build",
          signal_date: "2026-06-01",
          score: "55"
        })
      ],
      churches
    );
    assert.equal(plan.newContacts, 0);
    assert.equal(plan.newSignals, 1);
    assert.equal(plan.signalAdditions[0].signal.tag, "Building investment");
    assert.deepEqual(plan.signalAdditions[0].signal.signal_types, ["campaign", "renovation"]);
  });

  it("stores both signals and one person when the row is staff and a renovation", () => {
    const plan = planTechDirectorImport(
      [
        row({
          church: "First Baptist Church",
          city: "Macon",
          state: "GA",
          name: "Alex Kim",
          title: "Director of Media",
          contact: "alex@fbc.example",
          signal_types: "staff|renovation",
          evidence_quote: "Alex runs media during the renovation.",
          source_url: "https://fbc.example/news",
          score: "33"
        })
      ],
      churches
    );
    assert.equal(plan.newContacts, 1);
    assert.equal(plan.additions[0].contact.role, "Director of Media");
    assert.deepEqual(
      plan.signalAdditions.map((item) => item.signal.tag),
      ["Technical/media staff", "Building investment"]
    );
  });

  it("skips a signal already stored and keeps the church out of the directory-only count", () => {
    const withSignal: DirectoryChurch[] = churches.map((church) =>
      church.id === "g1"
        ? { ...church, signals: [{ tag: "Technical/media staff", evidenceQuote: "Already here.", sourceUrl: "https://gracechapel.example/staff" }] }
        : church
    );
    const plan = planTechDirectorImport(
      [
        row({
          church: "Grace Chapel",
          city: "Vidalia",
          website: "https://gracechapel.example",
          name: "New Person",
          signal_types: "staff",
          evidence_quote: "Already here.",
          source_url: "https://gracechapel.example/staff",
          score: "8"
        })
      ],
      withSignal
    );
    assert.equal(plan.inCrm, 1);
    assert.equal(plan.directoryOnly, 0);
    assert.equal(plan.newContacts, 1);
    assert.equal(plan.newSignals, 0);
    assert.equal(plan.signalDuplicatesSkipped, 1);
  });

  it("counts a directory church outside Georgia separately and does not write it", () => {
    const plan = planTechDirectorImport(
      [
        row({
          church: "Hope Church",
          city: "Birmingham",
          state: "AL",
          website: "https://hopebirmingham.example",
          name: "",
          signal_types: "campaign",
          evidence_quote: "Campaign.",
          score: "90"
        })
      ],
      churches
    );
    assert.equal(plan.matched, 1);
    assert.equal(plan.directoryOnly, 1);
    assert.equal(plan.inCrm, 0);
    assert.equal(plan.additions.length, 0);
    assert.equal(plan.signalAdditions.length, 0);
    assert.equal(plan.byState.AL.directoryOnly, 1);
  });
});

describe("church signal storage", () => {
  it("reads a pipeline church and leaves a bare directory church out of the CRM", () => {
    assert.equal(churchIsInCrm({ crmStatus: "open" }), true);
    assert.equal(churchIsInCrm({ inviteStatus: "accepted" }), true);
    assert.equal(churchIsInCrm({ isCustomer: "true" }), true);
    assert.equal(churchIsInCrm({ signedUp: false, websiteOfferStatus: "" }), false);
  });

  it("keeps an existing signal and will not append the same quote twice", () => {
    const merged = addChurchSignals(
      [{ id: "old", tag: "Building investment", evidence_quote: "Keep me", source_url: "https://example.org/a", score: 1, note: "stay" }],
      [
        {
          id: "sig-1",
          tag: "Technical/media staff",
          evidence_quote: "New quote",
          source_url: "https://example.org/b",
          signal_date: "2026-01-01",
          score: 4,
          signal_types: ["staff"]
        },
        {
          id: "sig-2",
          tag: "Building investment",
          evidence_quote: "Keep me",
          source_url: "https://example.org/a",
          signal_date: "",
          score: 9,
          signal_types: ["campaign"]
        }
      ]
    );
    assert.equal(merged.added, 1);
    assert.equal(merged.duplicates, 1);
    assert.equal(merged.signals[0].note, "stay");
    assert.equal(merged.signals.length, 2);
    const read = readChurchSignals(merged.signals);
    assert.equal(read.length, 2);
    assert.equal(read.find((signal) => signal.tag === "Technical/media staff")?.evidenceQuote, "New quote");
  });
});
