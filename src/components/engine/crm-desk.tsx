"use client";

import { useMemo, useState } from "react";
import {
  CRM_APP_LABEL,
  FOLLOW_UP_LABEL,
  MATCH_LABEL,
  type CrmApp,
  type CrmCard,
  type FollowUp,
  type FollowUpReason,
  type Touch
} from "@/lib/engine/lpl-crm-core";

// CRM v1 — one card per org or person, the don't-repeat rule, hard stops, and
// today's follow-ups. Read-only: every action button opens the app that owns
// the record. Contact details never reach this component.

type Props = {
  cards: CrmCard[];
  followUps: FollowUp[];
  adminUrls: Partial<Record<CrmApp, string>>;
};

type CardFilter = "active" | "multi" | "resting" | "stops" | "possible" | "presence" | "quiet" | "all";

const FILTER_LABEL: Record<CardFilter, string> = {
  active: "Reached or active",
  multi: "In more than one app",
  resting: "Resting (14 days)",
  stops: "Do not pitch",
  possible: "Possible matches",
  presence: "Tokens & events",
  quiet: "Not reached yet",
  all: "Everyone"
};

const REASONS: FollowUpReason[] = ["due", "warm", "waiting", "unpaid", "events", "tokens"];
const PAGE = 24;

const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function fmtDate(at: string | null | undefined): string {
  if (!at) return "";
  const date = new Date(at.length === 10 ? `${at}T12:00:00Z` : at);
  return Number.isNaN(date.getTime()) ? "" : dateFmt.format(date);
}

function fmtTime(at: string | null | undefined): string {
  if (!at) return "";
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? "" : `${timeFmt.format(date)} ET`;
}

function isQuiet(card: CrmCard): boolean {
  return !card.touches.length && !card.tokens.length && !card.events.length && !card.stops.length && !card.possibleMatches.length && card.apps.length < 2;
}

function matches(card: CrmCard, filter: CardFilter): boolean {
  switch (filter) {
    case "active":
      return !isQuiet(card);
    case "multi":
      return card.apps.length > 1;
    case "resting":
      return card.repeat.level === "hold";
    case "stops":
      return card.stops.length > 0;
    case "possible":
      return card.possibleMatches.length > 0;
    case "presence":
      return card.tokens.length > 0 || card.events.length > 0;
    case "quiet":
      return isQuiet(card);
    default:
      return true;
  }
}

function AppPill({ app }: { app: CrmApp }) {
  return <span className={`crm-pill crm-pill--${app}`}>{CRM_APP_LABEL[app]}</span>;
}

function TouchLine({ touch }: { touch: Touch }) {
  return (
    <li className={`crm-touch${touch.outreach ? " is-outreach" : ""}${touch.signal ? " is-signal" : ""}`}>
      <span className="crm-touch-when">{fmtTime(touch.at)}</span>
      <span className="crm-touch-body">
        <span className="crm-touch-head">
          <AppPill app={touch.app} />
          <span className="crm-touch-kind">{touch.outreach ? "We reached out" : touch.signal ? "They responded" : "Noted"}</span>
        </span>
        <span className="crm-touch-what">{touch.what}</span>
        {touch.response || touch.purchase ? (
          <span className="crm-touch-meta">
            {touch.response ? <span>Response: {touch.response}</span> : null}
            {touch.purchase ? <span className={touch.unpaid ? "crm-warn-text" : "crm-ok-text"}>Purchase: {touch.purchase}</span> : null}
          </span>
        ) : null}
      </span>
    </li>
  );
}

function CardView({ card, adminUrls, open }: { card: CrmCard; adminUrls: Props["adminUrls"]; open: boolean }) {
  const printed = card.tokens.filter((token) => token.printed === true).length;
  const notPrinted = card.tokens.filter((token) => token.printed === false).length;
  const matchText = card.matchedBy.length
    ? `Matched by ${card.matchedBy.map((kind) => MATCH_LABEL[kind]).join(", ")}`
    : card.recordCount > 1
      ? "Several records in one app"
      : `Only in ${card.apps.map((app) => CRM_APP_LABEL[app]).join(", ")}`;
  return (
    <article className={`crm-card${card.stops.length ? " has-stop" : card.repeat.level === "hold" ? " is-resting" : ""}`} id={card.key}>
      <header className="crm-card-head">
        <div className="crm-card-title">
          <h3>{card.name}</h3>
          <p className="crm-card-sub">
            {card.town || "Town not recorded"} · {matchText}
          </p>
        </div>
        <div className="crm-pills">
          {card.apps.map((app) => (
            <AppPill app={app} key={app} />
          ))}
        </div>
      </header>

      {card.stops.map((stop, index) => (
        <p className="crm-banner crm-banner--stop" key={`stop-${index}`} role="alert">
          <strong>Stop.</strong> {stop.text}
        </p>
      ))}
      {card.repeat.level ? (
        <p className={`crm-banner ${card.repeat.level === "hold" ? "crm-banner--hold" : "crm-banner--soon"}`}>
          <strong>{card.repeat.level === "hold" ? "Resting." : "Go gently."}</strong> {card.repeat.text}
        </p>
      ) : null}
      {card.possibleMatches.map((match, index) => (
        <p className="crm-banner crm-banner--maybe" key={`maybe-${index}`}>
          <strong>Possible match.</strong> {match.name}
          {match.town ? ` (${match.town})` : ""} in {match.apps.map((app) => CRM_APP_LABEL[app]).join(", ")} has the same name and town.
          Check before treating them as one.{" "}
          {match.key ? (
            <a className="crm-link" href={`#${match.key}`}>
              See that card
            </a>
          ) : null}
        </p>
      ))}

      <dl className="crm-facts">
        <div>
          <dt>Last reached out</dt>
          <dd>
            {card.lastOutreach ? (
              <>
                {card.lastOutreach.what}
                <span className="crm-dim">
                  {" "}
                  · {CRM_APP_LABEL[card.lastOutreach.app]} · {fmtDate(card.lastOutreach.at)}
                </span>
              </>
            ) : (
              <span className="crm-dim">Not yet</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Next step</dt>
          <dd>
            {card.nextActionDate ? (
              <>
                {card.nextAction || "Next step on file"}
                <span className="crm-dim"> · due {fmtDate(card.nextActionDate)}</span>
              </>
            ) : (
              <span className="crm-dim">None on file</span>
            )}
          </dd>
        </div>
        {card.tokens.length ? (
          <div>
            <dt>Tokens</dt>
            <dd>
              <span className="crm-ok-text">{printed} printed</span> · <span className={notPrinted ? "crm-warn-text" : "crm-dim"}>{notPrinted} not printed</span>
            </dd>
          </div>
        ) : null}
      </dl>

      <details className="crm-more" open={open}>
        <summary>
          Timeline <span className="crm-count">{card.touches.length}</span>
          {card.tokens.length || card.events.length || card.locations.length ? " · tokens, events and places" : ""}
        </summary>
        {card.touches.length ? (
          <ol className="crm-timeline">
            {card.touches.slice(0, 40).map((touch, index) => (
              <TouchLine touch={touch} key={`${touch.at}-${index}`} />
            ))}
          </ol>
        ) : (
          <p className="crm-dim crm-pad">Nothing sent, given, or heard yet.</p>
        )}
        {card.touches.length > 40 ? <p className="crm-dim crm-pad">Showing the newest 40 of {card.touches.length}.</p> : null}

        {card.tokens.length ? (
          <section className="crm-sub">
            <h4>Tokens</h4>
            <ul className="crm-list">
              {card.tokens.map((token, index) => (
                <li key={`${token.label}-${index}`}>
                  <span>{token.label}</span>
                  <span className={token.printed === true ? "crm-ok-text" : token.printed === false ? "crm-warn-text" : "crm-dim"}>
                    {token.printed === true ? "Printed" : token.printed === false ? "Not printed" : "Retired"}
                    <span className="crm-dim"> · {token.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {card.events.length ? (
          <section className="crm-sub">
            <h4>Events</h4>
            <ul className="crm-list">
              {card.events.map((event, index) => (
                <li key={`${event.title}-${index}`}>
                  <span>{event.title}</span>
                  <span className="crm-dim">
                    {event.startsAt ? fmtTime(event.startsAt) : "No date"}
                    {event.place ? ` · ${event.place}` : ""} · {event.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {card.locations.length ? (
          <section className="crm-sub">
            <h4>Places</h4>
            <ul className="crm-list">
              {card.locations.map((location, index) => (
                <li key={`${location.name}-${index}`}>
                  <span>{location.name}</span>
                  <span className="crm-dim">
                    {location.town}
                    {location.kind ? ` · ${location.kind}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </details>

      <div className="crm-actions">
        {card.apps.map((app) =>
          adminUrls[app] ? (
            <a className="dx-btn" href={adminUrls[app]} key={app} target={adminUrls[app]!.startsWith("/") ? undefined : "_blank"} rel="noreferrer">
              Open in {CRM_APP_LABEL[app]}
            </a>
          ) : null
        )}
      </div>
    </article>
  );
}

export function CrmDesk({ cards, followUps, adminUrls }: Props) {
  const [reason, setReason] = useState<FollowUpReason | "all">("all");
  const [filter, setFilter] = useState<CardFilter>("active");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [focus, setFocus] = useState<string | null>(null);

  const reasonCounts = useMemo(() => {
    const counts = Object.fromEntries(REASONS.map((item) => [item, 0])) as Record<FollowUpReason, number>;
    for (const item of followUps) counts[item.reason] += 1;
    return counts;
  }, [followUps]);

  const filterCounts = useMemo(() => {
    const out = {} as Record<CardFilter, number>;
    for (const key of Object.keys(FILTER_LABEL) as CardFilter[]) out[key] = cards.filter((card) => matches(card, key)).length;
    return out;
  }, [cards]);

  const shownFollowUps = reason === "all" ? followUps : followUps.filter((item) => item.reason === reason);

  const shownCards = useMemo(() => {
    if (focus) return cards.filter((card) => card.key === focus);
    const q = query.trim().toLowerCase();
    return cards.filter((card) => matches(card, filter) && (!q || `${card.name} ${card.town}`.toLowerCase().includes(q)));
  }, [cards, filter, query, focus]);

  const openCard = (key: string) => {
    setFocus(key);
    requestAnimationFrame(() => document.getElementById("crm-cards")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <section className="panel" id="crm-today" aria-labelledby="crm-today-title">
        <div className="crm-section-head">
          <div>
            <p className="dx-label">Today</p>
            <h2 id="crm-today-title" className="crm-h2">
              Follow-ups <span className="crm-count crm-count--lg">{followUps.length}</span>
            </h2>
          </div>
        </div>
        <div className="dx-chips crm-scroll-chips" role="group" aria-label="Filter follow-ups">
          <button type="button" className={`dx-chip crm-chip${reason === "all" ? " dx-chip--active" : ""}`} onClick={() => setReason("all")} aria-pressed={reason === "all"}>
            All <strong>{followUps.length}</strong>
          </button>
          {REASONS.map((item) => (
            <button
              type="button"
              key={item}
              className={`dx-chip crm-chip${reason === item ? " dx-chip--active" : ""}`}
              onClick={() => setReason(item)}
              aria-pressed={reason === item}
            >
              {FOLLOW_UP_LABEL[item]} <strong>{reasonCounts[item]}</strong>
            </button>
          ))}
        </div>
        {shownFollowUps.length ? (
          <ol className="crm-follow">
            {shownFollowUps.map((item, index) => (
              <li className={`crm-follow-row crm-follow-row--${item.reason}`} key={`${item.reason}-${item.cardKey}-${index}`}>
                <span className="crm-follow-tag">{FOLLOW_UP_LABEL[item.reason]}</span>
                <div className="crm-follow-main">
                  <p className="crm-follow-name">
                    <b>{item.name}</b>
                    {item.town ? <span className="crm-dim"> · {item.town}</span> : null}
                  </p>
                  <p className="crm-follow-why">{item.why}</p>
                  <p className="crm-follow-step">
                    <span className="crm-dim">Next:</span> {item.step}
                  </p>
                  <p className="crm-dim crm-follow-last">
                    {item.lastTouch
                      ? `Last reached out: ${CRM_APP_LABEL[item.lastTouch.app]} · ${fmtDate(item.lastTouch.at)}`
                      : "Not reached out yet"}
                  </p>
                </div>
                <button type="button" className="dx-btn crm-follow-open" onClick={() => openCard(item.cardKey)}>
                  Open card
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="crm-empty">Nothing waiting{reason === "all" ? " today" : ` under “${FOLLOW_UP_LABEL[reason as FollowUpReason]}”`}. Nice.</p>
        )}
      </section>

      <section className="panel" id="crm-cards" aria-labelledby="crm-cards-title">
        <div className="crm-section-head">
          <div>
            <p className="dx-label">People and places</p>
            <h2 id="crm-cards-title" className="crm-h2">
              One card each <span className="crm-count crm-count--lg">{cards.length}</span>
            </h2>
          </div>
          <label className="crm-search">
            <span className="crm-sr-only">Search by name or town</span>
            <input
              type="search"
              placeholder="Search name or town"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setFocus(null);
                setLimit(PAGE);
              }}
            />
          </label>
        </div>
        <div className="dx-chips crm-scroll-chips" role="group" aria-label="Filter cards">
          {(Object.keys(FILTER_LABEL) as CardFilter[]).map((key) => (
            <button
              type="button"
              key={key}
              className={`dx-chip crm-chip${!focus && filter === key ? " dx-chip--active" : ""}`}
              onClick={() => {
                setFilter(key);
                setFocus(null);
                setLimit(PAGE);
              }}
              aria-pressed={!focus && filter === key}
            >
              {FILTER_LABEL[key]} <strong>{filterCounts[key]}</strong>
            </button>
          ))}
        </div>
        {focus ? (
          <p className="crm-focus-note">
            Showing one card.{" "}
            <button type="button" className="crm-link-btn" onClick={() => setFocus(null)}>
              Show all cards
            </button>
          </p>
        ) : null}
        {shownCards.length ? (
          <div className="crm-grid">
            {shownCards.slice(0, limit).map((card) => (
              <CardView card={card} adminUrls={adminUrls} key={card.key} open={Boolean(focus)} />
            ))}
          </div>
        ) : (
          <p className="crm-empty">No cards match. Try another filter or clear the search.</p>
        )}
        {shownCards.length > limit ? (
          <div className="crm-more-wrap">
            <button type="button" className="dx-btn" onClick={() => setLimit((value) => value + PAGE)}>
              Show {Math.min(PAGE, shownCards.length - limit)} more of {shownCards.length - limit}
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}
