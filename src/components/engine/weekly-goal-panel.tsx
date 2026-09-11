import { dollars } from "@/lib/engine/stripe-summary";
import { MIX_STREAM_IDS, dollarsPlain, type Opportunity, type WeeklyGoalReport } from "@/lib/engine/weekly-revenue-goal";

function meterClass(report: WeeklyGoalReport): string {
  if (!report.goalStarted) return "dx-goal-meter";
  if (report.aheadCents > 0) return "dx-goal-meter is-ahead";
  if (report.onPace) return "dx-goal-meter is-pace";
  return "dx-goal-meter is-behind";
}

function meterWidth(report: WeeklyGoalReport): string {
  if (!report.thisWeek.goalCents) return "0%";
  return `${Math.min(100, Math.round((report.thisWeek.actualCents / report.thisWeek.goalCents) * 100))}%`;
}

function oppHref(item: Opportunity): { href: string; external: boolean } | null {
  if (!item.href) return null;
  return { href: item.href, external: item.href.startsWith("http") };
}

export function WeeklyGoalGlance({ report }: { report: WeeklyGoalReport }) {
  const tone = !report.goalStarted
    ? ""
    : report.aheadCents > 0
      ? "dx-stat--lime"
      : report.onPace
        ? "dx-stat--cyan"
        : "dx-stat--pink";
  return (
    <a className={`dx-stat ${tone}`.trim()} href="/reports/money#weekly-goal">
      <strong>
        {dollars(report.thisWeek.actualCents)}
        {report.goalStarted ? ` / ${dollars(report.thisWeek.goalCents)}` : ""}
      </strong>
      <span>{report.goalStarted ? "this week vs goal" : "this week · goal starts next"}</span>
      <p>
        {report.goalStarted
          ? report.gapCents
            ? `${dollarsPlain(report.gapCents)} to go · ${report.daysLeft} day${report.daysLeft === 1 ? "" : "s"} left →`
            : `ahead by ${dollarsPlain(report.aheadCents)} · next week ${dollarsPlain(report.nextWeekGoalCents)} →`
          : `$1,000 starts ${report.startLabel}. 25% growth after that →`}
      </p>
    </a>
  );
}

export function WeeklyGoalPanel({ report }: { report: WeeklyGoalReport }) {
  const mix = report.thisWeek.byStream.filter(
    (stream) => stream.charges > 0 || MIX_STREAM_IDS.includes(stream.id)
  );
  const act = report.opportunities.filter((item) => item.severity === "act");
  const watch = report.opportunities.filter((item) => item.severity === "watch");

  return (
    <section className="panel" id="weekly-goal">
      <p className="dx-label">Weekly income goal</p>
      <h2 className="dx-display" style={{ fontSize: "1.6rem", margin: "4px 0 8px" }}>
        {report.goalStarted ? (
          <>
            {dollars(report.thisWeek.actualCents)} of {dollars(report.thisWeek.goalCents)} <em>this week</em>
          </>
        ) : (
          <>
            $1,000 a week starts <em>{report.startLabel}</em>
          </>
        )}
      </h2>
      <p className="dx-lede">
        ChurchConnect, EasyPeazy, websites, laser, toner, Rally coaching, App Engine, Operate — Stripe this desk can
        actually read. Recurring (invoice or subscription wording) is split from one-off. After the first $1,000 week,
        the target is the higher of the 25% ladder and last week × 1.25, so a good week does not step the goal down.
      </p>
      <div className={meterClass(report)}>
        <span style={{ width: meterWidth(report) }} />
      </div>
      <p className="dx-note">
        {report.thisWeek.label} · {report.timezone}
        {report.percentOfGoal != null ? ` · ${report.percentOfGoal}% of goal` : ""}
        {report.expectedByNowCents != null
          ? ` · pace ${dollars(report.expectedByNowCents)} by now (day ${report.daysElapsed} of 7)`
          : ""}
        {report.onPace === false ? " · behind pace" : report.onPace ? " · on pace" : ""}
      </p>

      <div className="dx-stat-grid">
        <div className={`dx-stat ${report.goalStarted && report.gapCents ? "dx-stat--pink" : "dx-stat--lime"}`}>
          <strong>{report.goalStarted ? dollars(report.gapCents || report.aheadCents) : dollars(100_000)}</strong>
          <span>{report.goalStarted ? (report.gapCents ? "still needed" : "ahead") : "first-week target"}</span>
          <p>{report.daysLeft} day{report.daysLeft === 1 ? "" : "s"} left in {report.thisWeek.label}</p>
        </div>
        <div className="dx-stat dx-stat--cyan">
          <strong>{dollars(report.thisWeek.recurringCents)}</strong>
          <span>looks recurring this week</span>
          <p>
            {dollars(report.thisWeek.oneOffCents)} one-off · {report.thisWeek.charges} payment
            {report.thisWeek.charges === 1 ? "" : "s"}
          </p>
        </div>
        <div className="dx-stat">
          <strong>{dollars(report.lastWeek.actualCents)}</strong>
          <span>last week</span>
          <p>
            {report.lastWeek.label}
            {report.thisWeek.growthFloorCents
              ? ` · 25% floor ${dollars(report.thisWeek.growthFloorCents)}`
              : ""}
          </p>
        </div>
        <div className="dx-stat">
          <strong>{dollars(report.nextWeekGoalCents)}</strong>
          <span>next week target</span>
          <p>ladder {dollars(report.thisWeek.ladderCents || 100_000)} · then × 1.25</p>
        </div>
      </div>

      <p className="dx-label" style={{ marginTop: 18 }}>
        This week by product
      </p>
      <div className="dx-table-wrap">
        <table className="dx-table">
          <thead>
            <tr>
              <th>Stream</th>
              <th>This week</th>
              <th>Recurring</th>
              <th>Payments</th>
            </tr>
          </thead>
          <tbody>
            {mix.map((stream) => (
              <tr key={stream.id}>
                <td>
                  <a className="biz-name" href={`/reports/money?stream=${stream.id}`}>
                    {stream.label}
                  </a>
                </td>
                <td className="dx-mono">{stream.charges ? dollars(stream.cents) : "no labeled charges"}</td>
                <td className="dx-mono">{stream.recurringCents ? dollars(stream.recurringCents) : "—"}</td>
                <td className="dx-mono">{stream.charges || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="dx-label" style={{ marginTop: 18 }}>
        Where a dollar could come from
      </p>
      {act.map((item) => {
        const link = oppHref(item);
        return (
          <p className="dx-row" key={item.id}>
            <span className="dx-index">•</span>
            <b>{item.title}</b>
            <span className="dx-note">{item.detail}</span>
            {link ? (
              <a className="account-link" href={link.href} {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}>
                Open →
              </a>
            ) : null}
          </p>
        );
      })}
      {watch.map((item) => (
        <p className="dx-row" key={item.id}>
          <span className="dx-index">·</span>
          <b>{item.title}</b>
          <span className="dx-note">{item.detail}</span>
        </p>
      ))}

      <p className="dx-label" style={{ marginTop: 18 }}>
        25% ladder (does not include a beat-the-ladder floor)
      </p>
      <div className="dx-table-wrap">
        <table className="dx-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Ladder</th>
            </tr>
          </thead>
          <tbody>
            {report.upcoming.map((week) => (
              <tr key={week.startUnix}>
                <td>
                  {week.label}
                  {week.weekIndex === report.thisWeek.weekIndex ? " · this week" : ""}
                  {week.weekIndex === 0 && report.thisWeek.weekIndex !== 0 ? " · $1,000 start" : ""}
                </td>
                <td className="dx-mono">{dollars(week.ladderCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
