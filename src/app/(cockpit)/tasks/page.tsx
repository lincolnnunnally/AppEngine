import { redirect } from "next/navigation";
import { canAccessEngineAdmin } from "@/lib/auth/access";
import { listOwnerTasks, ownerTaskFileErrors } from "@/lib/engine/owner-tasks";
import {
  countTasks,
  isActiveStatus,
  KIND_LABEL,
  needsCheck,
  OWNER_TASK_KINDS,
  PRIORITY_LABEL,
  SORT_LABEL,
  SORT_MODES,
  sortTasksBy,
  taskLinkLabel,
  STATUS_LABEL,
  VERIFIED_FRESH_DAYS,
  type OwnerTask,
  type OwnerTaskKind,
  type OwnerTaskPriority,
  type OwnerTaskSort
} from "@/lib/engine/owner-tasks-core";
import { getCredentialAttentionItems, type CredentialAttentionItem } from "@/lib/engine/ecosystem-credential-registry";
import { getPortfolioUrlStatusBoard } from "@/lib/engine/portfolio-url-status";
import { OwnerTaskActions, OwnerTaskAddForm } from "@/components/engine/owner-task-actions";

export const dynamic = "force-dynamic";

// The owner's to-do list: every ask an agent made of Lincoln, kept until he
// clears it. Agents add to it through source-of-truth/owner-tasks.json or the
// API (source-of-truth/owner-task-queue.md). Keys only he can create are read
// live from the credential registry and shown here too, so there is ONE list.

function dayLabel(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : day;
}

function TaskCard({ task, appName, now }: { task: OwnerTask; appName: string; now: Date }) {
  const active = isActiveStatus(task.status);
  const tagClass = task.priority === "blocker" ? "dx-tag dx-tag--alert" : task.priority === "recommended" ? "dx-tag dx-tag--warn" : "dx-tag";
  const unchecked = needsCheck(task, now);
  return (
    // The desk panel deep-links here with #<id>, so each card is an anchor.
    <article className="inbox-card owner-task-card" id={task.id} data-status={task.status}>
      <p className="dx-label">
        <span className={tagClass}>{active ? PRIORITY_LABEL[task.priority] : STATUS_LABEL[task.status]}</span>{" "}
        {task.appSlug === "ecosystem" ? (
          "All apps"
        ) : (
          <a className="account-link" href={`/apps/${encodeURIComponent(task.appSlug)}`}>
            {appName}
          </a>
        )}
        {" · "}
        {KIND_LABEL[task.kind]}
        {task.status === "waiting" ? (task.kind === "decision" && task.ownerNote ? " · answered, an agent is acting on it" : " · started, waiting on someone") : ""}
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
      {active ? (
        unchecked ? (
          <p className="owner-task-check owner-task-check--warn">
            {task.verifiedOn
              ? `Last double-checked ${dayLabel(task.verifiedOn)}, more than ${VERIFIED_FRESH_DAYS} days ago.`
              : "No agent has double-checked this against the real setting yet."}{" "}
            Read the steps with care. If anything is off, tap <b>This is wrong</b>.
          </p>
        ) : (
          <p className="owner-task-check owner-task-check--ok">
            ✓ Double-checked {dayLabel(task.verifiedOn!)}
            {task.verifiedHow ? `: ${task.verifiedHow}` : ""}
          </p>
        )
      ) : null}
      {task.ownerNote && task.status !== "wrong" ? <p className="dx-note owner-task-answer">You said: {task.ownerNote}</p> : null}
      {task.status === "wrong" ? <p className="dx-note owner-task-answer">{task.ownerNote}</p> : null}
      {task.link && active ? (
        <p style={{ marginTop: 8 }}>
          <a
            className="dx-btn dx-btn--primary"
            href={task.link}
            target={task.link.startsWith("/") ? undefined : "_blank"}
            rel="noreferrer"
          >
            {taskLinkLabel(task.link)}
          </a>
        </p>
      ) : null}
      <p className="dx-note" style={{ marginTop: 8, fontSize: "0.78rem" }}>
        Asked by {task.requestedBy || "an agent"}
        {task.createdAt ? ` · ${new Date(task.createdAt).toLocaleDateString("en-US")}` : ""}
        {task.source ? ` · ${task.source}` : ""}
        {task.doneAt && !active ? ` · closed ${new Date(task.doneAt).toLocaleDateString("en-US")}` : ""}
      </p>
      <OwnerTaskActions id={task.id} status={task.status} ownerNote={task.ownerNote} kind={task.kind} />
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

// Importance order, most important first. The list is already sorted this way;
// grouping makes the shape of it visible instead of one long undifferentiated run.
const PRIORITY_ORDER: OwnerTaskPriority[] = ["blocker", "recommended", "optional"];

function isPriority(value: string): value is OwnerTaskPriority {
  return (PRIORITY_ORDER as string[]).includes(value);
}

function isKind(value: string): value is OwnerTaskKind {
  return (OWNER_TASK_KINDS as readonly string[]).includes(value);
}

function isSort(value: string): value is OwnerTaskSort {
  return (SORT_MODES as readonly string[]).includes(value);
}

// Everything a person might remember a task by: its words, its steps, the app
// it belongs to, who asked. Every search term has to appear somewhere, so
// "facebook churchconnect" narrows rather than widens.
function taskMatches(task: OwnerTask, terms: string[], appName: string): boolean {
  if (!terms.length) return true;
  const haystack = [
    task.title,
    task.why,
    ...task.steps,
    appName,
    task.appSlug,
    KIND_LABEL[task.kind],
    PRIORITY_LABEL[task.priority],
    task.requestedBy,
    task.source,
    task.id
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export default async function OwnerTasksPage({
  searchParams
}: {
  searchParams: Promise<{ app?: string; show?: string; q?: string; priority?: string; kind?: string; sort?: string; check?: string }>;
}) {
  if (!(await canAccessEngineAdmin())) redirect("/");
  const params = await searchParams;
  const slug = params.app || "";
  const showClosed = params.show === "closed";
  const query = (params.q || "").trim().slice(0, 120);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const priority = params.priority && isPriority(params.priority) ? params.priority : null;
  const kind = params.kind && isKind(params.kind) ? params.kind : null;
  const sort: OwnerTaskSort = params.sort && isSort(params.sort) ? params.sort : "importance";
  const uncheckedOnly = params.check === "needed";
  const now = new Date();

  // Every filter link keeps the others, so narrowing by importance never
  // silently drops the search or the app the owner already picked.
  type Next = { app?: string | null; show?: string | null; q?: string | null; priority?: string | null; kind?: string | null; sort?: string | null; check?: string | null };
  const tasksHref = (next: Next) => {
    const merged = {
      app: next.app === undefined ? slug : next.app,
      show: next.show === undefined ? (showClosed ? "closed" : "") : next.show,
      q: next.q === undefined ? query : next.q,
      priority: next.priority === undefined ? priority : next.priority,
      kind: next.kind === undefined ? kind : next.kind,
      sort: next.sort === undefined ? (sort === "importance" ? "" : sort) : next.sort,
      check: next.check === undefined ? (uncheckedOnly ? "needed" : "") : next.check
    };
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) search.set(key, value);
    }
    const text = search.toString();
    return text ? `/tasks?${text}` : "/tasks";
  };

  const board = getPortfolioUrlStatusBoard();
  const names = new Map(board.entries.map((entry) => [entry.slug, entry.appName]));
  const nameFor = (value: string) => names.get(value) || value;

  const [allTasks, keyItems] = await Promise.all([
    listOwnerTasks(),
    getCredentialAttentionItems().catch(() => [] as CredentialAttentionItem[])
  ]);
  const counts = countTasks(allTasks);
  const scoped = slug ? allTasks.filter((task) => task.appSlug === slug) : allTasks;
  const inView = scoped.filter((task) => (showClosed ? !isActiveStatus(task.status) : isActiveStatus(task.status)));
  const searched = inView.filter((task) => taskMatches(task, terms, nameFor(task.appSlug)));
  const narrowed = searched
    .filter((task) => (kind ? task.kind === kind : true))
    .filter((task) => (uncheckedOnly ? needsCheck(task, now) : true));
  const shown = sortTasksBy(priority ? narrowed.filter((task) => task.priority === priority) : narrowed, sort, nameFor);
  const byKind = Object.fromEntries(OWNER_TASK_KINDS.map((value) => [value, searched.filter((task) => task.kind === value).length])) as Record<
    OwnerTaskKind,
    number
  >;
  // Counts per level of importance, over what the search left — so each chip
  // says how many it will show before it is clicked.
  const byPriority = Object.fromEntries(
    PRIORITY_ORDER.map((level) => [level, narrowed.filter((task) => task.priority === level).length])
  ) as Record<OwnerTaskPriority, number>;
  const groups = PRIORITY_ORDER.map((level) => ({ level, tasks: shown.filter((task) => task.priority === level) })).filter(
    (group) => group.tasks.length > 0
  );
  const filtering = Boolean(query) || Boolean(priority) || Boolean(kind) || uncheckedOnly;
  // Grouped by importance only when sorted by importance; any other order is one list.
  const listGroups = sort === "importance" ? groups : [{ level: null as OwnerTaskPriority | null, tasks: shown }];
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
        <div className="dx-stat-grid owner-task-stats">
          <a className={`dx-stat ${counts.blockers ? "dx-stat--pink" : ""}`} href="/tasks?priority=blocker#list">
            <strong>{counts.blockers}</strong>
            <span>blocking something</span>
            <p>{counts.blockers ? "start with these" : "nothing is stuck on you"}</p>
          </a>
          <a className="dx-stat dx-stat--cyan" href="/tasks#list">
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
          <a className={`dx-chip${!slug && !showClosed ? " dx-chip--active" : ""}`} href={tasksHref({ app: null, show: null })}>
            All apps <strong>{counts.open + counts.waiting}</strong>
          </a>
          {appsWithTasks.map(([appSlug, count]) => (
            <a
              key={appSlug}
              className={`dx-chip${slug === appSlug ? " dx-chip--active" : ""}`}
              href={tasksHref({ app: appSlug })}
            >
              {appSlug === "ecosystem" ? "All-app items" : nameFor(appSlug)} <strong>{count}</strong>
            </a>
          ))}
          <a className={`dx-chip${showClosed ? " dx-chip--active" : ""}`} href={tasksHref({ show: "closed" })}>
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

      <section className="panel" id="list">
        <p className="dx-label">{showClosed ? "Cleared" : "Your list"}{slug ? ` — ${slug === "ecosystem" ? "all-app items" : nameFor(slug)}` : ""}</p>

        {/* A plain GET form: Enter searches, the result is a URL that can be
            bookmarked or sent, and it works before any script loads. */}
        <form className="owner-task-search" action="/tasks#list" method="get" role="search">
          {slug ? <input type="hidden" name="app" value={slug} /> : null}
          {showClosed ? <input type="hidden" name="show" value="closed" /> : null}
          {priority ? <input type="hidden" name="priority" value={priority} /> : null}
          {kind ? <input type="hidden" name="kind" value={kind} /> : null}
          {sort !== "importance" ? <input type="hidden" name="sort" value={sort} /> : null}
          {uncheckedOnly ? <input type="hidden" name="check" value="needed" /> : null}
          <label className="owner-task-search-label" htmlFor="task-search">
            Find a task
          </label>
          <input
            id="task-search"
            className="biz-search desk-input"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="facebook, dns, stripe, an app’s name…"
            autoComplete="off"
          />
          <button className="dx-btn dx-btn--primary" type="submit">
            Search
          </button>
        </form>

        <div className="dx-chips owner-task-levels" aria-label="Filter by importance">
          <a className={`dx-chip${!priority ? " dx-chip--active" : ""}`} href={`${tasksHref({ priority: null })}#list`}>
            Every level <strong>{narrowed.length}</strong>
          </a>
          {PRIORITY_ORDER.map((level) => (
            <a
              key={level}
              className={`dx-chip owner-task-level owner-task-level--${level}${priority === level ? " dx-chip--active" : ""}`}
              href={`${tasksHref({ priority: level })}#list`}
            >
              {PRIORITY_LABEL[level]} <strong>{byPriority[level]}</strong>
            </a>
          ))}
        </div>

        <div className="dx-chips" aria-label="Filter by type">
          <a className={`dx-chip${!kind ? " dx-chip--active" : ""}`} href={`${tasksHref({ kind: null })}#list`}>
            Every type
          </a>
          {OWNER_TASK_KINDS.filter((value) => byKind[value] > 0).map((value) => (
            <a key={value} className={`dx-chip${kind === value ? " dx-chip--active" : ""}`} href={`${tasksHref({ kind: value })}#list`}>
              {KIND_LABEL[value]} <strong>{byKind[value]}</strong>
            </a>
          ))}
          {!showClosed && counts.unchecked ? (
            <a
              className={`dx-chip${uncheckedOnly ? " dx-chip--active" : ""}`}
              href={`${tasksHref({ check: uncheckedOnly ? null : "needed" })}#list`}
              title="Asks no agent has double-checked in the last two weeks"
            >
              Not double-checked <strong>{counts.unchecked}</strong>
            </a>
          ) : null}
        </div>

        <div className="owner-task-sortbar" aria-label="Sort">
          <span className="dx-label">Sort</span>
          {SORT_MODES.map((mode) => (
            <a key={mode} className={`dx-chip${sort === mode ? " dx-chip--active" : ""}`} href={`${tasksHref({ sort: mode === "importance" ? null : mode })}#list`}>
              {SORT_LABEL[mode]}
            </a>
          ))}
        </div>

        {filtering ? (
          <p className="dx-note owner-task-result">
            {shown.length} {shown.length === 1 ? "task" : "tasks"}
            {query ? <> matching &ldquo;{query}&rdquo;</> : null}
            {priority ? ` · ${PRIORITY_LABEL[priority].toLowerCase()} only` : ""}
            {kind ? ` · ${KIND_LABEL[kind].toLowerCase()} only` : ""}
            {uncheckedOnly ? " · not double-checked" : ""}
            {" · "}
            <a className="account-link" href={`${tasksHref({ q: null, priority: null, kind: null, check: null })}#list`}>
              clear
            </a>
          </p>
        ) : null}

        {shown.length === 0 ? (
          <div className="dx-callout">
            <b>
              {filtering
                ? "No task matches that."
                : showClosed
                  ? "Nothing cleared in the last 30 days."
                  : "Nothing waiting on you."}
            </b>{" "}
            <span className="dx-note">
              {filtering
                ? slug
                  ? "This search is limited to one app — try All apps, or fewer words."
                  : "Try fewer words, or one word from the title."
                : showClosed
                  ? "Finished items show here for 30 days."
                  : "When an agent needs you, the ask shows up here."}
            </span>
          </div>
        ) : (
          // Grouped by importance, most important first, each group counted —
          // so the list's weight shows at a glance instead of as one long run.
          listGroups.map((group) => (
            <div className="owner-task-group" key={group.level ?? "all"}>
              {group.level ? (
                <h2 className={`owner-task-group-head owner-task-group-head--${group.level}`}>
                  {PRIORITY_LABEL[group.level]}
                  <span>{group.tasks.length}</span>
                </h2>
              ) : null}
              {group.tasks.map((task) => (
                <TaskCard key={task.id} task={task} appName={nameFor(task.appSlug)} now={now} />
              ))}
            </div>
          ))
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
