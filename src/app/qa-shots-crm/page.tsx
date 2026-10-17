// TEMPORARY local screenshot harness. Never committed.
import { buildCards, buildFollowUps } from "@/lib/engine/lpl-crm-core";
import { CrmDesk } from "@/components/engine/crm-desk";

export const dynamic = "force-dynamic";

export default async function QaShots({ searchParams }: { searchParams: Promise<{ save?: string }> }) {
  const { save } = await searchParams;
  const canSave = save === "1";
  const now = new Date();
  const ago = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
  const cards = buildCards(
    [
      {
        id: "cc:church:11111111-1111-4111-8111-111111111111",
        churchId: "11111111-1111-4111-8111-111111111111",
        app: "churchconnect",
        kind: "org",
        name: "QA CRM v2 — delete",
        town: "Covington, GA",
        emails: ["office@qa-crm-v2.invalid"],
        domains: ["qa-crm-v2.invalid"],
        phones: [],
        links: [],
        nextActionDate: null,
        touches: [{ at: ago(3), app: "churchconnect", kind: "visit", what: "Visit, met Jane Doe, left a welcome card", outreach: true, restDays: 14, dateOnly: true }],
        contacts: [{ id: "sc-qa0000000001", name: "Jane Doe", title: "Church secretary", email: "jane@qa-crm-v2.invalid", phone: "(404) 555-0142", source: "saved" }]
      }
    ],
    { emails: new Set(), domains: new Set(), phones: new Set() },
    now
  );
  return (
    <main className="shell wide-shell crm-page">
      <section className="panel biz-hero">
        <p className="dx-label">People and places</p>
        <h1 className="dx-display">
          Who we have <em>reached</em>, and who is next.
        </h1>
        {canSave ? null : (
          <p className="dx-callout" role="status">
            Saving isn&apos;t available on this preview. You can look, but visits and contacts can&apos;t be saved from here.
          </p>
        )}
      </section>
      <CrmDesk cards={cards} followUps={buildFollowUps(cards, now)} adminUrls={{}} canSave={canSave} />
    </main>
  );
}
