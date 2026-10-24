import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isTechnicalDirector, parsePublishedContact, readChurchSignals, signalsForContact, technicalDirectorsFromStaff } from "./tech-director-core.ts";
import {
  addChurchSignals,
  addStaffContacts,
  churchDocPatch,
  churchIsInCrm,
  churchSignalLeadBody,
  formatImportCounts,
  matchDirectoryChurch,
  nextChurchDoc,
  parseImportSkipFile,
  parseTechDirectorCsv,
  planTechDirectorImport,
  stampStaffContact,
  techDirectorContactId,
  type DirectoryChurch,
  type TechDirectorCsvRow
} from "./tech-director.ts";
import { cardMatchesCrmSearch, cleanContactOutreach } from "./lpl-crm-core.ts";

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
    church_id: "",
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
  it("matches a website domain when the city, state, and bare host agree", () => {
    const match = matchDirectoryChurch(
      row({ church: "Some Other Name", city: "Vidalia", state: "GA", website: "https://www.gracechapel.example", name: "Jane Doe" }),
      churches
    );
    assert.equal("church" in match && match.church.id, "g1");
  });

  it("does not attach a path on the same host when the name does not agree", () => {
    const match = matchDirectoryChurch(
      row({ church: "Some Other Name", city: "Vidalia", state: "GA", website: "https://www.gracechapel.example/give", name: "Jane Doe" }),
      churches
    );
    assert.equal("church" in match, false);
  });

  it("matches a website domain when the normalized name agrees", () => {
    const match = matchDirectoryChurch(
      row({ church: "Grace Chapel", city: "Atlanta", state: "GA", website: "https://www.gracechapel.example/give", name: "Jane Doe" }),
      churches
    );
    assert.equal("church" in match && match.church.id, "g1");
  });

  it("does not attach a domain when the name and the city disagree", () => {
    const athens: DirectoryChurch[] = [
      { id: "athens", name: "Grace Church", churchName: "", city: "Athens", state: "GA", website: "https://grace.org", domain: "grace.org", inCrm: true, contacts: [] }
    ];
    const match = matchDirectoryChurch(
      row({ church: "Totally Different", city: "Savannah", state: "GA", website: "https://grace.org", name: "Pat" }),
      athens
    );
    assert.equal("church" in match, false);
    assert.equal("reason" in match && match.reason, "The website matches one church, but the name does not agree, and the city, state, and bare website do not agree.");
  });

  it("does not attach Bethel AME on elca.org/find/bethel to St John Lutheran in Savannah", () => {
    const list: DirectoryChurch[] = [
      {
        id: "stjohn",
        name: "St John Lutheran",
        churchName: "",
        city: "Savannah",
        state: "GA",
        website: "https://elca.org/find/stjohn",
        domain: "elca.org",
        inCrm: true,
        contacts: []
      }
    ];
    const match = matchDirectoryChurch(
      row({ church: "Bethel AME", city: "Savannah", state: "GA", website: "https://elca.org/find/bethel", name: "Pat" }),
      list
    );
    assert.equal("church" in match, false);
  });

  it("does not attach Grace in Columbus OH to Calvary in Columbus GA", () => {
    const list: DirectoryChurch[] = [
      {
        id: "calvary",
        name: "Calvary",
        churchName: "",
        city: "Columbus",
        state: "GA",
        website: "https://calvary.example",
        domain: "calvary.example",
        inCrm: true,
        contacts: []
      }
    ];
    const match = matchDirectoryChurch(
      row({ church: "Grace", city: "Columbus", state: "OH", website: "https://calvary.example", name: "Pat" }),
      list
    );
    assert.equal("church" in match, false);
  });

  it("treats a trailing Church and St. as the same name", () => {
    const list: DirectoryChurch[] = [
      {
        id: "sj",
        name: "Saint John Lutheran Church",
        churchName: "",
        city: "Savannah",
        state: "GA",
        website: "",
        domain: "",
        inCrm: true,
        contacts: []
      }
    ];
    const match = matchDirectoryChurch(row({ church: "St. John Lutheran", city: "Savannah", state: "Georgia", name: "Pat" }), list);
    assert.equal("church" in match && match.church.id, "sj");
  });

  it("does not attach a shared conference host to a different church", () => {
    const list: DirectoryChurch[] = [
      { id: "macon", name: "First Methodist", churchName: "", city: "Macon", state: "GA", website: "https://www.umc.org/find/first", domain: "", inCrm: true, contacts: [] },
      { id: "sav", name: "Bethel AME", churchName: "", city: "Savannah", state: "GA", website: "", domain: "", inCrm: true, contacts: [] }
    ];
    const match = matchDirectoryChurch(
      row({ church: "Bethel AME", city: "Savannah", state: "GA", website: "https://umc.org/find/bethel", name: "Pat" }),
      list
    );
    assert.equal("church" in match && match.church.id, "sav");
    const onlyMacon = matchDirectoryChurch(
      row({ church: "Bethel AME", city: "Savannah", state: "GA", website: "https://umc.org/find/bethel", name: "Pat" }),
      list.filter((church) => church.id === "macon")
    );
    assert.equal("church" in onlyMacon, false);
  });

  it("matches church_id when the name and state agree, and does not fall through when the id is missing", () => {
    const byId = matchDirectoryChurch(
      row({ church_id: "fbc", church: "First Baptist", city: "Savannah", state: "GA", website: "https://grace.org", name: "Pat" }),
      churches
    );
    assert.equal("church" in byId && byId.church.id, "fbc");
    const missing = matchDirectoryChurch(
      row({ church_id: "missing", church: "Grace Chapel", city: "Vidalia", state: "GA", website: "https://gracechapel.example", name: "Jane Doe" }),
      churches
    );
    assert.equal("reason" in missing && missing.reason, "No church on file has that church id.");
    assert.equal("flagged" in missing && missing.flagged, false);
  });

  it("flags a church_id whose name or state does not agree and does not attach it", () => {
    const wrongName = matchDirectoryChurch(
      row({ church_id: "fbc", church: "Totally Different", city: "Macon", state: "GA", website: "https://grace.org", name: "Pat" }),
      churches
    );
    assert.equal("church" in wrongName, false);
    assert.equal("flagged" in wrongName && wrongName.flagged, true);
    const wrongState = matchDirectoryChurch(
      row({ church_id: "fbc", church: "First Baptist Church", city: "Macon", state: "OH", name: "Pat" }),
      churches
    );
    assert.equal("church" in wrongState, false);
    assert.equal("flagged" in wrongState && wrongState.flagged, true);
    const plan = planTechDirectorImport(
      [row({ church_id: "fbc", church: "Totally Different", city: "Macon", state: "GA", name: "Pat King", signal_types: "staff", score: "3" })],
      churches
    );
    assert.equal(plan.matched, 0);
    assert.equal(plan.additions.length, 0);
    assert.equal(plan.unmatched.length, 0);
    assert.equal(plan.flagged.length, 1);
    assert.match(plan.flagged[0].reason, /name or state/);
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
      ["church", "church_id", "city", "state", "website", "staff_page_url", "name", "title", "contact", "signal_types", "evidence_quote", "source_url", "signal_date", "score"]
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
    assert.equal(parsed.rows[0].church_id, "");
    assert.equal(parsed.rows[0].name, "Sam");
  });

  it("reads church_id first and ignores builder columns", () => {
    const parsed = parseTechDirectorCsv(
      "church_id,builder_name,church,builder_role,city,builder_url,state,website,staff_page_url,name,title,contact,signal_types,evidence_quote,source_url,signal_date,score,notes\n" +
        "g1,Acme Builders,Grace Chapel,General contractor,Vidalia,https://acme.example/job,GA,https://gracechapel.example,https://gracechapel.example/staff,Jane Doe,Director of Media,jane@gracechapel.example,staff,\"Jane Doe leads media.\",https://gracechapel.example/staff,2026-04-01,80,ignore me\n"
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.rows[0].church_id, "g1");
    assert.equal(parsed.rows[0].church, "Grace Chapel");
    assert.equal(parsed.rows[0].city, "Vidalia");
    assert.equal(parsed.rows[0].name, "Jane Doe");
    assert.equal(parsed.rows[0].title, "Director of Media");
    assert.equal(parsed.rows[0].evidence_quote, "Jane Doe leads media.");
    assert.equal(parsed.rows[0].score, "80");
    const plan = planTechDirectorImport(parsed.rows, churches);
    assert.equal(plan.flagged.length, 0);
    assert.equal(plan.additions[0].churchId, "g1");
    assert.equal(plan.additions[0].contact.name, "Jane Doe");
  });

  it("flags the Archdiocese office and the shallowford mismatch instead of writing them", () => {
    const directory: DirectoryChurch[] = [
      { id: "office", name: "Archdiocese of Atlanta", churchName: "", city: "Atlanta", state: "GA", website: "https://archatl.org", domain: "", inCrm: true, contacts: [] },
      { id: "shallow", name: "Shallowford", churchName: "", city: "Atlanta", state: "GA", website: "https://shallowford.org", domain: "", inCrm: true, contacts: [] }
    ];
    const plan = planTechDirectorImport(
      [
        row({
          church: "Archdiocese of Atlanta",
          city: "Atlanta",
          state: "GA",
          website: "https://archatl.org",
          name: "Office Desk",
          signal_types: "staff",
          evidence_quote: "The office is listed.",
          source_url: "https://archatl.org/staff",
          score: "10"
        }),
        row({
          church: "Cristo Para Todas Las Naciones",
          city: "Atlanta",
          state: "GA",
          website: "https://www.shallowford.org/about",
          name: "Media",
          signal_types: "staff",
          evidence_quote: "Wrong site.",
          source_url: "https://shallowford.org",
          score: "10"
        })
      ],
      directory
    );
    assert.equal(plan.flagged.length, 2);
    assert.equal(plan.matched, 0);
    assert.equal(plan.additions.length, 0);
    assert.equal(plan.signalAdditions.length, 0);
    assert.match(plan.flagged[0].reason, /Archdiocese of Atlanta/);
    assert.match(plan.flagged[1].reason, /shallowford\.org/);
    assert.match(formatImportCounts(plan), /flagged: 2/);
  });

  it("flags a matched church when its id is on the skip list", () => {
    const skip = parseImportSkipFile("church_id,church,reason\nfbc,,Skip this church\n");
    assert.equal(skip.ok, true);
    if (!skip.ok) return;
    const plan = planTechDirectorImport(
      [
        row({
          church: "First Baptist Church",
          city: "Macon",
          state: "GA",
          name: "Sam",
          signal_types: "staff",
          evidence_quote: "Sam leads media.",
          source_url: "https://fbc.example/staff",
          score: "3"
        })
      ],
      churches,
      skip.flags
    );
    assert.equal(plan.flagged.length, 1);
    assert.equal(plan.flagged[0].reason, "Skip this church");
    assert.equal(plan.additions.length, 0);
    assert.equal(plan.signalAdditions.length, 0);
  });

  it("reads an optional church_id column", () => {
    const parsed = parseTechDirectorCsv(
      "church,church_id,city,website,staff_page_url,name,title,contact,signal_types,evidence_quote,source_url,signal_date,score\nHope,g1,Macon,https://hope.example,https://hope.example/staff,Sam,Director,,staff,Quoted,https://hope.example/staff,2026-01-01,5\n"
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.rows[0].church_id, "g1");
    assert.equal(parsed.rows[0].state, "");
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
    assert.equal(plan.signalsUpdated, 0);
  });

  it("updates the score and date when the same evidence is newer", () => {
    const withSignal: DirectoryChurch[] = churches.map((church) =>
      church.id === "g1"
        ? { ...church, signals: [{ tag: "Technical/media staff", evidenceQuote: "Already here.", sourceUrl: "https://gracechapel.example/staff", signalDate: "2026-01-01" }] }
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
          signal_date: "2026-06-01",
          score: "40"
        })
      ],
      withSignal
    );
    assert.equal(plan.newSignals, 0);
    assert.equal(plan.signalDuplicatesSkipped, 0);
    assert.equal(plan.signalsUpdated, 1);
    assert.equal(plan.signalUpdates[0].signal.score, 40);
    assert.equal(plan.signalUpdates[0].signal.signal_date, "2026-06-01");
    assert.equal(plan.byState.GA.signalsUpdated, 1);
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
    assert.equal(merged.updated, 0);
    assert.equal(merged.signals[0].note, "stay");
    assert.equal(merged.signals[0].score, 1);
    assert.equal(merged.signals.length, 2);
    const read = readChurchSignals(merged.signals);
    assert.equal(read.length, 2);
    assert.equal(read.find((signal) => signal.tag === "Technical/media staff")?.evidenceQuote, "New quote");
  });

  it("replaces the score and date when the stored evidence is older", () => {
    const merged = addChurchSignals(
      [{ id: "old", tag: "Building investment", evidence_quote: "Keep me", source_url: "https://example.org/a", signal_date: "2026-01-01", score: 1, note: "stay" }],
      [
        {
          id: "sig-2",
          tag: "Building investment",
          evidence_quote: "Keep me",
          source_url: "https://example.org/a",
          signal_date: "2026-08-01",
          score: 9,
          signal_types: ["campaign"]
        }
      ]
    );
    assert.equal(merged.added, 0);
    assert.equal(merged.updated, 1);
    assert.equal(merged.signals.length, 1);
    assert.equal(merged.signals[0].note, "stay");
    assert.equal(merged.signals[0].id, "old");
    assert.equal(merged.signals[0].score, 9);
    assert.equal(merged.signals[0].signal_date, "2026-08-01");
  });

  it("changes only the contact list, the signal list, and updated_at on the church doc", () => {
    const merged = nextChurchDoc(
      { name: "Grace Chapel", city: "Vidalia", pastor_name: "Pat", staff_contacts: [], crm_signals: [], updated_at: "2026-01-01T00:00:00.000Z" },
      [
        {
          id: "td-1",
          name: "Jane Doe",
          role: "Director of Media",
          email: "jane@gracechapel.example",
          phone: "",
          tags: ["Technical director"],
          source_url: "https://gracechapel.example/staff"
        }
      ],
      [],
      [],
      "2026-08-01T00:00:00.000Z"
    );
    assert.equal(merged.changed, true);
    assert.equal(merged.doc.name, "Grace Chapel");
    assert.equal(merged.doc.pastor_name, "Pat");
    assert.equal(merged.doc.city, "Vidalia");
    assert.equal(merged.doc.updated_at, "2026-08-01T00:00:00.000Z");
    assert.equal(merged.addedContacts, 1);
    const unchanged = nextChurchDoc(
      { name: "Grace Chapel", staff_contacts: [{ name: "Jane Doe" }], crm_signals: [] },
      [
        {
          id: "td-1",
          name: "Jane Doe",
          role: "Director of Media",
          email: "",
          phone: "",
          tags: ["Technical director"],
          source_url: ""
        }
      ],
      [],
      [],
      "2026-08-01T00:00:00.000Z"
    );
    assert.equal(unchanged.changed, false);
    assert.equal("updated_at" in unchanged.doc, false);
  });

  it("patches only staff_contacts, crm_signals, and updated_at", () => {
    const merged = nextChurchDoc({ name: "Grace", pastor_name: "Pat", staff_contacts: [], crm_signals: [] }, [], [], [], "2026-08-01T00:00:00.000Z");
    const patch = churchDocPatch({ ...merged.doc, staff_contacts: [{ name: "Ann" }], crm_signals: [], updated_at: "2026-08-02T00:00:00.000Z" });
    assert.deepEqual(Object.keys(patch).sort(), ["crm_signals", "staff_contacts", "updated_at"]);
  });
});

describe("crm search and contact status", () => {
  const grace = {
    name: "Grace Chapel",
    town: "Vidalia, GA",
    state: "GA",
    contacts: [{ name: "Jane Doe", title: "Director of Media", tags: ["Technical director"] }],
    signals: [{ tag: "Technical/media staff" }, { tag: "Building investment" }]
  };
  const palm = {
    name: "Palm Chapel",
    town: "Orlando, FL",
    state: "FL",
    contacts: [],
    signals: [{ tag: "Building investment" }]
  };

  it("finds a church by name, person, title, city, state, and tag", () => {
    assert.equal(cardMatchesCrmSearch(grace, "grace chapel"), true);
    assert.equal(cardMatchesCrmSearch(grace, "jane doe"), true);
    assert.equal(cardMatchesCrmSearch(grace, "director of media"), true);
    assert.equal(cardMatchesCrmSearch(grace, "vidalia"), true);
    assert.equal(cardMatchesCrmSearch(grace, "ga"), true);
    assert.equal(cardMatchesCrmSearch(grace, "technical/media staff"), true);
    assert.equal(cardMatchesCrmSearch(grace, "building investment"), true);
    assert.equal(cardMatchesCrmSearch(palm, "technical/media staff"), false);
    assert.equal(cardMatchesCrmSearch(palm, "orlando"), true);
    assert.equal(cardMatchesCrmSearch(grace, ""), true);
  });

  it("accepts a note, a day, and a contact status, and rejects a send-shaped gap", () => {
    const ok = cleanContactOutreach({ note: "Left a message.", day: "2026-04-02", status: "contacted", contactId: "td-preview", name: "Jane Doe" });
    assert.equal(typeof ok === "string", false);
    if (typeof ok === "string") return;
    assert.equal(ok.status, "contacted");
    assert.equal(ok.day, "2026-04-02");
    for (const status of ["new", "contacted", "follow-up", "meeting", "won", "lost"]) {
      assert.equal(typeof cleanContactOutreach({ note: "Called.", day: "2026-04-02", status, contactId: "td-preview", name: "Jane Doe" }) === "string", false);
    }
    assert.equal(typeof cleanContactOutreach({ note: "", day: "2026-04-02", status: "new", contactId: "td-preview", name: "Jane Doe" }), "string");
    assert.equal(typeof cleanContactOutreach({ note: "Called.", day: "2026-04-02", status: "emailed", contactId: "td-preview", name: "Jane Doe" }), "string");
    assert.equal(typeof cleanContactOutreach({ note: "Called.", day: "April 2", status: "new", contactId: "td-preview", name: "Jane Doe" }), "string");
  });

  it("shows staff evidence on the contact and keeps a building quote on a matching source", () => {
    const signals = [
      { id: "a", tag: "Technical/media staff", evidenceQuote: "Jane leads media.", sourceUrl: "https://gracechapel.example/staff", signalDate: "2026-04-01", score: 80 },
      { id: "b", tag: "Building investment", evidenceQuote: "Hall rebuild.", sourceUrl: "https://bethel.example/build", signalDate: "2026-03-01", score: 40 }
    ];
    const director = signalsForContact({ tags: ["Technical director"], sourceUrl: "https://gracechapel.example/staff" }, signals);
    assert.deepEqual(director.map((signal) => signal.id), ["a"]);
    const facilities = signalsForContact({ tags: [], sourceUrl: "https://bethel.example/build" }, signals);
    assert.deepEqual(facilities.map((signal) => signal.id), ["b"]);
  });

  it("stores an unmatched row as a church-signal lead on the existing lead shape", () => {
    const body = churchSignalLeadBody(
      row({
        church: "Bethel AME",
        city: "Savannah",
        state: "GA",
        website: "https://elca.org/find/bethel",
        name: "Pat Lee",
        title: "Facilities",
        signal_types: "renovation",
        evidence_quote: "The hall is being rebuilt.",
        source_url: "https://bethel.example/build",
        score: "40"
      }),
      "No church on file matches this row."
    );
    const signals = body.signals as { kind: string; tag: string };
    assert.equal(signals.kind, "church-signal");
    assert.equal(signals.tag, "Building investment");
    assert.equal(body.business_name, "Bethel AME");
    assert.equal(Array.isArray(body.contacts), true);
    assert.equal((body.contacts as Array<{ status: string }>)[0].status, "new");
    assert.match(String(body.slug), /^cs-/);
  });
});
