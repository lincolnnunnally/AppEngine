import { redirect } from "next/navigation";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { listOwnerTasks, ownerTaskFileErrors } from "@/lib/engine/owner-tasks";
import { countTasks, isActiveStatus, KIND_LABEL, PRIORITY_LABEL, type OwnerTask } from "@/lib/engine/owner-tasks-core";
import { getCredentialAttentionItems, type CredentialAttentionItem } from "@/lib/engine/ecosystem-credential-registry";
import { getPortfolioUrlStatusBoard } from "@/lib/engine/portfolio-url-status";
import { OwnerTaskActions, OwnerTaskAddForm } from "@/components/engine/owner-task-actions";

export const dynamic = "force-dynamic";

// The owner's to-do list: every ask an agent made of Lincoln, kept until he
// clears it. Agents add to it through source-of-truth/owner-tasks.json or the
// API (source-of-truth/owner-task-queue.md). Keys only he can create are read
// live from the credential registry and shown here too, so there is ONE list.

function TaskCard({ task, appName }: { task: OwnerTask; appName: string }) {
  const active = isActiveStatus(task.status);
  const tagClass = task.priority === "blocker" ? "dx-tag dx-tag--alert" : task.priority === "recommended" ? "dx-tag dx-tag--warn" : "dx-tag";
  return (
    <article className="inbox-card owner-task-card" data-status={task.status}>
      <p className="dx-label">
        <span className={tagClass}>{active ? PRIORITY_LABEL[task.priority] : task.status === "done" ? "Done" : "Not doing"}</span>{" "}
        {task.appSlug === "ecosystem" ? (
          "All apps"
        ) : (
          <a className="account-link" href={`/apps/${encodeURIComponent(task.appSlug)}`}>
            {appName}
          </a>
        )}
        {" · "}
        {KIND_LABEL[task.kind]}
        {task.status === "waiting" ? " · started, waiting on someone" : ""}
      </p>
      <h3>{task.title}</h3>
      {task.why ? <p className="dx-note">{task.why}</p> : null}
      {task.steps.length ? (
        <ol className="owner-task-steps">
          {task.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      ) : null}
      {task.link && active ? (
        <p style={{ marginTop: 8 }}>
          <a
            className="dx-btn dx-btn--primary"
            href={task.link}
            target={task.link.startsWith("/") ? undefined : "_blank"}
            rel="noreferrer"
          >
            Do it here {task.link.startsWith("/") ? "→" : "↗"}
          </a>
        </p>
      ) : null}
      <p className="dx-note" style={{ marginTop: 8, fontSize: "0.78rem" }}>
        Asked by {task.requestedBy || "an agent"}
        {task.createdAt ? ` · ${new Date(task.createdAt).toLocaleDateString("en-US")}` : ""}
        {task.source ? ` · ${task.source}` : ""}
        {task.doneAt && !active ? ` · closed ${new Date(task.doneAt).toLocaleDateString("en-US")}` : ""}
      </p>
      <OwnerTaskActions id={task.id} status={task.status} ownerNote={task.ownerNote} />
    </article>
  );
}

function KeyCard({ item }: { item: CredentialAttentionItem }) {
  return (
    <p className="dx-row">
      <span className={item.priority === "blocker" ? "dx-tag dx-tag--alert" : "dx-tag dx-tag--warn"}>
        {item.priority === "blocker" ? "Blocking" : item.priority === "recommended" ? "Should do" : "When you can"}
      </span>
      <b>{item.appName}</b>
      <span className="dx-note">
        {item.displayName} (<code>{item.envVar}</code>) — {item.action}
      </span>
      <a className="account-link" href="/integrations">
        Save it on Keys →
      </a>
    </p>
  );
}

export default async function OwnerTasksPage({
  searchParams
}: {
  searchParams: Promise<{ app?: string; show?: string }>;
}) {
  if (!(await canAccessEngineAdmin())) redirect("/");
  const params = await searchParams;
  const slug = params.app || "";
  const showClosed = params.show === "closed";

  const board = getPortfolioUrlStatusBoard();
  const names = new Map(board.entries.map((entry) => [entry.slug, entry.appName]));
  const nameFor = (value: string) => names.get(value) || value;

  const [allTasks, keyItems] = await Promise.all([
    listOwnerTasks(),
    getCredentialAttentionItems().catch(() => [] as CredentialAttentionItem[])
  ]);
  const counts = countTasks(allTasks);
  const scoped = slug ? allTasks.filter((task) => task.appSlug === slug) : allTasks;
  const shown = scoped.filter((task) => (showClosed ? !isActiveStatus(task.status) : isActiveStatus(task.status)));
  const keys = slug ? keyItems.filter((item) => item.slug === slug) : keyItems;
  const fileErrors = ownerTaskFileErrors();
  const appsWithTasks = Object.entries(counts.bySlug).sort((a, b) => b[1] - a[1]);

  return (
    <main className="shell">
      <section className="panel">
        <p className="dx-label">To do</p>
        <h1 className="dx-display">
          Only <em>you</em> can do these.
        </h1>
        <p className="dx-lede">
          Every time an agent needs you to pay for something, create a key, or make a call about what an app is, it lands
          here and stays until you clear it. Nothing gets buried in a chat. Agents do the rest themselves.
        </p>
        <div className="dx-stat-grid">
          <a className={`dx-stat ${counts.blockers ? "dx-stat--pink" : ""}`} href="/tasks">
            <strong>{counts.blockers}</strong>
            <span>blocking something</span>
            <p>{counts.blockers ? "start with these" : "nothing is stuck on you"}</p>
          </a>
          <a className="dx-stat dx-stat--cyan" href="/tasks">
            <strong>{counts.open}</strong>
            <span>to do</span>
            <p>{counts.waiting} started, waiting on someone</p>
          </a>
          <a className="dx-stat dx-stat--lime" href="/tasks?show=closed">
            <strong>{counts.done}</strong>
            <span>done (30 days)</span>
            <p>see what got cleared →</p>
          </a>
          <a className={`dx-stat ${keyItems.length ? "dx-stat--pink" : ""}`} href="#keys">
            <strong>{keyItems.length}</strong>
            <span>keys only you can create</span>
            <p>read live from the key registry</p>
          </a>
        </div>
        <div className="dx-chips" style={{ marginTop: 16 }}>
          <a className={`dx-chip${!slug && !showClosed ? " dx-chip--active" : ""}`} href="/tasks">
            All apps <strong>{counts.open + counts.waiting}</strong>
          </a>
          {appsWithTasks.map(([appSlug, count]) => (
            <a
              key={appSlug}
              className={`dx-chip${slug === appSlug ? " dx-chip--active" : ""}`}
              href={`/tasks?app=${encodeURIComponent(appSlug)}`}
            >
              {appSlug === "ecosystem" ? "All-app items" : nameFor(appSlug)} <strong>{count}</strong>
            </a>
          ))}
          <a className={`dx-chip${showClosed ? " dx-chip--active" : ""}`} href={`/tasks?show=closed${slug ? `&app=${encodeURIComponent(slug)}` : ""}`}>
            Done / not doing
          </a>
        </div>
        <div style={{ marginTop: 14 }}>
          <OwnerTaskAddForm apps={board.entries.map((entry) => ({ slug: entry.slug, name: entry.appName }))} />
        </div>
      </section>

      {fileErrors.length ? (
        <section className="panel">
          <div className="dx-callout dx-callout--alert">
            <b>Some agent asks could not be read.</b>{" "}
            <span className="dx-note">
              source-of-truth/owner-tasks.json has problems, so those items are missing from this list: {fileErrors.join("; ")}
            </span>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <p className="dx-label">{showClosed ? "Cleared" : "Your list"}{slug ? ` — ${slug === "ecosystem" ? "all-app items" : nameFor(slug)}` : ""}</p>
        {shown.length === 0 ? (
          <div className="dx-callout">
            <b>{showClosed ? "Nothing cleared in the last 30 days." : "Nothing waiting on you."}</b>{" "}
            <span className="dx-note">
              {showClosed ? "Finished items show here for 30 days." : "When an agent needs you, the ask shows up here."}
            </span>
          </div>
        ) : (
          shown.map((task) => <TaskCard key={task.id} task={task} appName={nameFor(task.appSlug)} />)
        )}
      </section>

      {!showClosed ? (
        <section className="panel" id="keys">
          <p className="dx-label">Keys only you can create</p>
          <p className="dx-note" style={{ marginBottom: 10 }}>
            Create the key at the provider, then paste it once on{" "}
            <a className="account-link" href="/integrations">
              Keys
            </a>
            . On that page, &quot;Push all my saved keys&quot; copies it into each app&apos;s hosting. Vercel-hosted keys clear from
            this list on their own once they show up there.
          </p>
          {keys.length === 0 ? <p className="dx-note">No keys waiting on you.</p> : keys.map((item) => <KeyCard key={`${item.slug}:${item.envVar}`} item={item} />)}
        </section>
      ) : null}
    </main>
  );
}
