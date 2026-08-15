import { HelpForm } from "@/components/help/help-form";
import { listHelpApps } from "@/lib/engine/app-ops-catalog";
import { getPortfolioUrlStatusBoard } from "@/lib/engine/portfolio-url-status";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Need a hand?",
  description: "Tell us what is going wrong. A real person will read it and get back to you."
};

export default async function HelpPage({
  searchParams
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const params = await searchParams;
  const board = getPortfolioUrlStatusBoard();
  const names = new Map(board.entries.map((entry) => [entry.slug, entry.appName]));
  const apps = listHelpApps()
    .map((entry) => ({
      slug: entry.slug,
      name: names.get(entry.slug) || entry.slug
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const initial = apps.some((entry) => entry.slug === params.app) ? params.app || "other" : params.app || "other";

  return (
    <main className="shell help-shell">
      <section className="panel">
        <p className="dx-label">Help</p>
        <h1 className="dx-display">
          Need a <em>hand</em>?
        </h1>
        <p className="dx-lede">
          If something on one of these apps is broken, confusing, or just not working for you — say so. This goes to a
          real person. You will get a reply.
        </p>
      </section>
      <section className="panel">
        <HelpForm apps={apps} initialApp={initial} />
      </section>
    </main>
  );
}
