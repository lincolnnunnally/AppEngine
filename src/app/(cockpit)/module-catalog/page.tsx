import { redirect } from "next/navigation";
import { canAccessEngineOwner } from "@/lib/auth/access";
import { loadModuleCatalog, type ModuleCatalogEntry } from "@/lib/engine/module-catalog";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ModuleCatalogEntry["status"], string> = {
  in_use: "In use",
  extractable: "Mine from a repo",
  planned: "Planned"
};

export default async function ModuleCatalogPage() {
  if (!(await canAccessEngineOwner())) {
    redirect("/soft-launch");
  }

  const catalog = loadModuleCatalog();
  const categories = Array.from(new Set(catalog.modules.map((module) => module.category)));

  return (
    <main className="shell wide-shell module-catalog-page" data-testid="module-catalog-page">
      <section className="card">
        <p className="eyebrow">Lego System</p>
        <h1>Module catalog</h1>
        <p>
          The reusable build blocks the factory composes apps from. Build a new app by snapping these together —
          reuse a block, never rebuild it. Each block lists the apps already using it and where the strongest
          existing code lives to mine first.
        </p>
        <div className="guardrail-strip" aria-label="Module reuse rules">
          <span>Reuse, never rebuild</span>
          <span>One home per block</span>
          <span>Customer data stays isolated</span>
        </div>
      </section>

      {categories.map((category) => (
        <section className="card" key={category}>
          <p className="eyebrow">{category.replaceAll("_", " ")}</p>
          <div className="detail-grid">
            {catalog.modules
              .filter((module) => module.category === category)
              .map((module) => (
                <article key={module.slug} data-testid={`module-${module.slug}`}>
                  <p className="eyebrow" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{module.name}</span>
                    <code>{STATUS_LABEL[module.status]}</code>
                  </p>
                  <p>{module.purpose}</p>
                  <p className="empty-state">
                    <strong>Does:</strong> {module.capabilities.join(", ")}
                  </p>
                  <p className="empty-state">
                    <strong>Used by:</strong> {module.usedByApps.length ? module.usedByApps.join(", ") : "—"}
                  </p>
                  <p className="empty-state">
                    <strong>Mine first:</strong> {module.primarySource}
                  </p>
                </article>
              ))}
          </div>
        </section>
      ))}
    </main>
  );
}
