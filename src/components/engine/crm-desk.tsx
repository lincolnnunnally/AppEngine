"use client";

import { useMemo, useState } from "react";
import { ChurchTools } from "@/components/engine/crm-church-tools";
import { AddOrg, OrgTools } from "@/components/engine/crm-org-tools";
import {
  CRM_APP_LABEL,
  FOLLOW_UP_LABEL,
  MATCH_LABEL,
  adminHomeNote,
  countTokens,
  hasClockTime,
  recordLink,
  type CrmApp,
  type CrmCard,
  type FollowUp,
  type FollowUpReason,
  type OrgKind,
  type Touch
} from "@/lib/engine/lpl-crm-core";

// CRM — one card per org or person, the don't-repeat rule, hard stops, and
// today's follow-ups. Most buttons open the app that owns the record. On a
// ChurchConnect church the owner can also log a visit and save contacts
// (crm-church-tools.tsx). Church contact emails and phones reach this
// component only for the owner; the page strips them for anyone else. Match
// emails and phones from the other apps never reach it.

type Props = {
  cards: CrmCard[];
  followUps: FollowUp[];
  adminUrls: Partial<Record<CrmApp, string>>;
  /** Owner only, and only when saving is switched on for this deploy. */
  canSave?: boolean;
};

type CardFilter = "all" | "today" | "multi" | "resting" | "stops" | "possible" | "presence" | "quiet";

const FILTER_LABEL: Record<CardFilter, string> = {
  all: "Everyone",
  today: "On today's list",
  multi: "In more than one app",
  resting: "Resting",
  stops: "Do not pitch",
  possible: "Possible matches",
  presence: "Tokens & events",
  quiet: "Not reached out yet"
};

const REASONS: FollowUpReason[] = ["due", "warm", "unpaid", "events", "tokens", "wait"];
const PAGE = 24;

const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
const yearFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" });

function fmtDate(at: string | null | undefined): string {
  if (!at) return "";
  const date = new Date(hasClockTime(at) ? at : `${at.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  // "Oct 8" this year, "Oct 8, 2025" otherwise.
  return yearFmt.format(date) === yearFmt.format(new Date()) ? dayFmt.format(date) : dateFmt.format(date);
}

function fmtTime(at: string | null | undefined): string {
  if (!at) return "";
  if (!hasClockTime(at)) return fmtDate(at);
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  const time = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(date);
  return `${fmtDate(at)}, ${time} ET`;
}

/** Same test the card uses for "Last reached out: Not yet". */
function isQuiet(card: CrmCard): boolean {
  return !card.lastOutreach;
}

function matches(card: CrmCard, filter: CardFilter): boolean {
  switch (filter) {
    case "today":
      return card.followUpReasons.some((reason) => reason !== "wait");
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
      <span className="crm-touch-when">{touch.dateOnly ? fmtDate(touch.at) : fmtTime(touch.at)}</span>
      <span className="crm-touch-body">
        <span className="crm-touch-head">
          <AppPill app={touch.app} />
          <span className="crm-touch-kind">{touch.kind === "visit" ? "We visited" : touch.kind === "drop_off" ? "We dropped off" : touch.outreach ? "We reached out" : touch.signal ? "They responded" : "Noted"}</span>
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

function CardView({
  card,
  adminUrls,
  open,
  onOpen,
  onOpenOrg,
  canSave
}: {
  card: CrmCard;
  adminUrls: Props["adminUrls"];
  open: boolean;
  onOpen: (key: string) => void;
  onOpenOrg: (match: { kind: OrgKind; id: string }) => void;
  canSave: boolean;
}) {
  const printed = countTokens(card.tokens, true);
  const notPrinted = countTokens(card.tokens, false);
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
        <p className={`crm-banner ${card.repeat.level === "hold" ? "crm-banner--hold" : card.repeat.level === "replied" ? "crm-banner--ok" : "crm-banner--soon"}`}>
          <strong>{card.repeat.level === "hold" ? "Resting." : card.repeat.level === "replied" ? "Replied." : "Go gently."}</strong> {card.repeat.text}
        </p>
      ) : null}
      {card.possibleMatches.map((match, index) => (
        <p className="crm-banner crm-banner--maybe" key={`maybe-${index}`}>
          <strong>Possible match.</strong> {match.name}
          {match.town ? ` (${match.town})` : ""} in {match.apps.map((app) => CRM_APP_LABEL[app]).join(", ")} has the same name and town.
          Check before treating them as one.{" "}
          {match.key ? (
            <button type="button" className="crm-link-btn" onClick={() => onOpen(match.key!)}>
              See that card
            </button>
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
          <dd>{card.nextStep ? card.nextStep : <span className="crm-dim">{card.stops.some((stop) => stop.reason !== "customer") ? "None. Do not pitch." : "None on file"}</span>}</dd>
        </div>
        {card.nextActionDate && card.nextStep !== card.nextAction ? (
          <div>
            <dt>On file</dt>
            <dd>
              {card.nextAction || "Next step"}
              <span className="crm-dim">
                {" "}
                · due {fmtDate(card.nextActionDate)}
                {card.nextActionMovedFrom ? ` (moved from ${fmtDate(card.nextActionMovedFrom)} while resting)` : ""}
              </span>
            </dd>
          </div>
        ) : null}
        {card.tokens.length ? (
          <div>
            <dt>Tokens</dt>
            <dd>
              <span className="crm-ok-text">{printed} printed</span> · <span className={notPrinted ? "crm-warn-text" : "crm-dim"}>{notPrinted} not printed</span>
            </dd>
          </div>
        ) : null}
      </dl>

      <OrgTools card={card} canSave={canSave} onOpen={onOpenOrg} />
      <ChurchTools card={card} canSave={canSave} />

      <details className="crm-more" open={open}>
        <summary>
          Timeline ({card.touches.length})
        </summary>
        {card.tokens.length || card.events.length || card.locations.length ? (
          <p className="crm-dim crm-pad">Messages and visits first, then this card&apos;s tokens, events and places.</p>
        ) : null}
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
        {card.apps.map((app) => {
          const link = recordLink(app, card, adminUrls);
          if (!link) return null;
          return (
            <a
              className="dx-btn"
              href={link.href}
              key={app}
              target={link.href.startsWith("/") ? undefined : "_blank"}
              rel="noreferrer"
              title={link.exact ? undefined : adminHomeNote(app)}
            >
              {link.exact ? `Open in ${CRM_APP_LABEL[app]}` : `${CRM_APP_LABEL[app]} admin`}
            </a>
          );
        })}
      </div>
      {card.apps
        .filter((app) => adminUrls[app] && !card.recordPaths[app])
        .map((app) => (
          <p className="crm-dim crm-actions-note" key={`note-${app}`}>
            {adminHomeNote(app)}
          </p>
        ))}
    </article>
  );
}

function FollowRow({ row, onOpen }: { row: FollowUp; onOpen: (key: string) => void }) {
  const lead = row.reasons[0];
  return (
    <li className={`crm-follow-row crm-follow-row--${lead}`}>
      <span className="crm-follow-tags">
        {row.reasons.map((item) => (
          <span className={`crm-follow-tag crm-follow-tag--${item}`} key={item}>
            {FOLLOW_UP_LABEL[item]}
          </span>
        ))}
      </span>
      <div className="crm-follow-main">
        <p className="crm-follow-name">
          <b>{row.name}</b>
          {row.town ? <span className="crm-dim"> · {row.town}</span> : null}
        </p>
        <ul className="crm-follow-items">
          {row.items.map((item, index) => (
            <li className="crm-follow-why" key={`${item.reason}-${index}`}>
              {item.why}
            </li>
          ))}
        </ul>
        <p className="crm-follow-step">
          <span className="crm-dim">Next step:</span> {row.nextStep}
        </p>
        <p className="crm-dim crm-follow-last">
          {row.lastTouch ? `Last reached out: ${CRM_APP_LABEL[row.lastTouch.app]} · ${fmtDate(row.lastTouch.at)}` : "Not reached out yet"}
        </p>
      </div>
      <button type="button" className="dx-btn crm-follow-open" onClick={() => onOpen(row.cardKey)}>
        Open card
      </button>
    </li>
  );
}

export function CrmDesk({ cards, followUps, adminUrls, canSave = false }: Props) {
  const [reason, setReason] = useState<FollowUpReason | "all">("all");
  const [filter, setFilter] = useState<CardFilter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [focus, setFocus] = useState<string | null>(null);

  const todayRows = useMemo(() => followUps.filter((row) => row.today), [followUps]);
  const waitOnlyRows = useMemo(() => followUps.filter((row) => !row.today), [followUps]);

  // Counts are orgs/people, not reasons: one row per card.
  const reasonCounts = useMemo(() => {
    const counts = Object.fromEntries(REASONS.map((item) => [item, 0])) as Record<FollowUpReason, number>;
    for (const row of followUps) for (const item of row.reasons) counts[item] += 1;
    return counts;
  }, [followUps]);

  const filterCounts = useMemo(() => {
    const out = {} as Record<CardFilter, number>;
    for (const key of Object.keys(FILTER_LABEL) as CardFilter[]) out[key] = cards.filter((card) => matches(card, key)).length;
    return out;
  }, [cards]);

  const shownFollowUps = reason === "all" ? todayRows : followUps.filter((row) => row.reasons.includes(reason));

  const shownCards = useMemo(() => {
    if (focus) return cards.filter((card) => card.key === focus);
    const q = query.trim().toLowerCase();
    return cards.filter((card) => matches(card, filter) && (!q || `${card.name} ${card.town}`.toLowerCase().includes(q)));
  }, [cards, filter, query, focus]);

  const openCard = (key: string) => {
    setFocus(key);
    requestAnimationFrame(() => document.getElementById("crm-cards")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  // "Open it" from an add/edit match: the card on this desk, or the record in ChurchConnect.
  const [orgNote, setOrgNote] = useState("");
  const openOrg = (match: { kind: OrgKind; id: string }) => {
    const card = cards.find((item) => item.org?.id === match.id || (match.kind === "church" && item.churchId === match.id));
    if (card) {
      setOrgNote("");
      openCard(card.key);
      return;
    }
    const link = match.kind === "church" ? recordLink("churchconnect", { recordPaths: { churchconnect: `/super-admin#crm/lead/${match.id}` } }, adminUrls) : null;
    if (link) {
      window.open(link.href, "_blank", "noopener,noreferrer");
      setOrgNote("That church isn't on this desk yet (nothing logged on it), so it opened in ChurchConnect.");
    } else {
      setOrgNote("That one isn't on this desk yet. Reload in a moment.");
    }
  };

  return (
    <>
      <section className="panel" id="crm-today" aria-labelledby="crm-today-title">
        <div className="crm-section-head">
          <div>
            <p className="dx-label">Today</p>
            <h2 id="crm-today-title" className="crm-h2">
              Follow-ups <span className="crm-count crm-count--lg">{todayRows.length}</span>
            </h2>
            <p className="crm-dim crm-section-note">
              One row per church, place, or person. Resting ones wait below and do not count as today.
            </p>
          </div>
        </div>
        <div className="dx-chips crm-scroll-chips" role="group" aria-label="Filter follow-ups">
          <button type="button" className={`dx-chip crm-chip${reason === "all" ? " dx-chip--active" : ""}`} onClick={() => setReason("all")} aria-pressed={reason === "all"}>
            Today <strong>{todayRows.length}</strong>
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
            {shownFollowUps.map((row) => (
              <FollowRow row={row} key={row.cardKey} onOpen={openCard} />
            ))}
          </ol>
        ) : (
          <p className="crm-empty">Nothing{reason === "all" ? " for today" : ` under “${FOLLOW_UP_LABEL[reason as FollowUpReason]}”`}. Nice.</p>
        )}
        {reason === "all" && waitOnlyRows.length ? (
          <details className="crm-more crm-wait-group">
            <summary>Resting, wait ({waitOnlyRows.length})</summary>
            <p className="crm-dim crm-pad">Someone reached out in the last 14 days and they have not replied. Let it rest until the date shown.</p>
            <ol className="crm-follow">
              {waitOnlyRows.map((row) => (
                <FollowRow row={row} key={row.cardKey} onOpen={openCard} />
              ))}
            </ol>
          </details>
        ) : null}
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
        <details className="crm-legend">
          <summary>What the words mean</summary>
          <dl>
            <div><dt>Resting</dt><dd>An app reached out in the last 14 days and they have not replied. Wait until the date shown.</dd></div>
            <div><dt>Replied</dt><dd>They answered after our last reach-out, so it is fine to follow up now.</dd></div>
            <div><dt>Go gently</dt><dd>Fine to follow up, but we reached out recently or more than once, so keep it soft.</dd></div>
            <div><dt>Stop</dt><dd>Do not pitch: on the do-not-contact list, already a customer for that offer, or they said no.</dd></div>
            <div><dt>Possible match</dt><dd>Same name and town in another app. Not joined, so check before treating them as one.</dd></div>
            <div><dt>Matched by same website</dt><dd>Records joined into one card because they share a website (or a linked record, email, or phone).</dd></div>
            <div><dt>Tokens printed</dt><dd>A Presence token counts as printed once it is engraved (or released or found).</dd></div>
          </dl>
        </details>
        {canSave ? <AddOrg onOpen={openOrg} /> : null}
        {orgNote ? (
          <p className="crm-form-status crm-warn-text" role="status">
            {orgNote}
          </p>
        ) : null}
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
              <CardView card={card} adminUrls={adminUrls} key={card.key} open={Boolean(focus)} onOpen={openCard} onOpenOrg={openOrg} canSave={canSave} />
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
