"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AvProspects } from "@/components/engine/crm-av-prospects";
import { TopProspects } from "@/components/engine/crm-top-prospects";
import type { AvProspectState, TopProspectState } from "@/app/(cockpit)/crm/actions";
import { ChurchSignals, PeopleTools, SignalQueueActions, TechDirectorPeople } from "@/components/engine/crm-church-tools";
import { AddOrg, OrgTools, offerLabel } from "@/components/engine/crm-org-tools";
import { SuggestNextStep } from "@/components/engine/crm-suggest";
import { AVL_TIER_LABEL, SIGNAL_BUILDING, SIGNAL_STAFF, churchHasTechnicalDirector, churchSignalScore, stateCode, type AvlTier } from "@/lib/engine/tech-director-core";
import {
  CRM_APP_LABEL,
  FOLLOW_UP_LABEL,
  MATCH_LABEL,
  adminHomeNote,
  countTokens,
  hasClockTime,
  recordLink,
  withOutreachLog,
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
  /** Owner only: "Suggested next step" on each card. Admins never get it. */
  isOwner?: boolean;
  /** The do-not-contact list couldn't be read: suggest nothing. */
  outreachHidden?: boolean;
  /** Local preview only: open Top prospects with fixture rows already read. */
  topInitial?: TopProspectState;
  /** Local preview only: open AV prospects with fixture rows already read. */
  avInitial?: AvProspectState;
  /** Local preview only: open the Technical director filter. */
  techFirst?: boolean;
  /** Owner search already applied on the server. The box submits back to /crm. */
  searchQuery?: string;
  /** preview=tech (and the others) must survive a search submit. */
  preview?: string;
};

function ChipScroller({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflow(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  });
  return (
    <div ref={ref} className={`dx-chips crm-scroll-chips${overflow ? " is-overflowing" : ""}`} role="group" aria-label={label}>
      {children}
    </div>
  );
}

type CardFilter = "all" | "today" | "multi" | "resting" | "stops" | "possible" | "presence" | "quiet" | "tech";

const FILTER_LABEL: Record<Exclude<CardFilter, "tech">, string> = {
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

/** A logged day, always with the year: "Apr 2, 2026". */
function fmtLoggedDay(at: string): string {
  const date = new Date(`${at.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(date);
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
  return !card.lastOutreach && !card.existingAvlTalks;
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
    case "tech":
      return churchHasTechnicalDirector(card.contacts);
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
      <span className="crm-touch-when">{touch.dateOnly || !hasClockTime(touch.at) ? fmtLoggedDay(touch.at) : fmtTime(touch.at)}</span>
      <span className="crm-touch-body">
        <span className="crm-touch-head">
          {/* A business lead's own notes don't need a second "Business lead" pill. */}
          {touch.app === "business" ? null : <AppPill app={touch.app} />}
          <span className="crm-touch-kind">{touch.kind === "visit" ? "You visited" : touch.kind === "drop_off" ? "You dropped off" : touch.outreach ? "We reached out" : touch.signal ? "They responded" : "Noted"}</span>
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
  card: source,
  adminUrls,
  open,
  onOpen,
  onOpenOrg,
  canSave,
  isOwner,
  outreachHidden
}: {
  card: CrmCard;
  adminUrls: Props["adminUrls"];
  open: boolean;
  onOpen: (key: string) => void;
  onOpenOrg: (match: { kind: OrgKind; id: string }) => void;
  canSave: boolean;
  isOwner: boolean;
  outreachHidden: boolean;
}) {
  const card = withOutreachLog(source);
  const printed = countTokens(card.tokens, true);
  const notPrinted = countTokens(card.tokens, false);
  // A card that is only a business lead: say which apps were picked (or none yet): "Only in Operate", "In Operate and AI Website Design".
  const businessOnly = card.apps.length === 1 && card.apps[0] === "business" && card.org?.kind === "business";
  const businessApps = businessOnly ? (card.org?.offers ?? []).map((id) => offerLabel("business", id)).filter(Boolean) : [];
  const matchText = businessOnly
    ? businessApps.length === 1
      ? `Only in ${businessApps[0]}`
      : businessApps.length
        ? `In ${businessApps.slice(0, -1).join(", ")} and ${businessApps[businessApps.length - 1]}`
        : "Not in any app yet"
    : card.matchedBy.length
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
          {isOwner && card.avlTier && AVL_TIER_LABEL[card.avlTier as AvlTier] ? (
            <p className="crm-dim" data-testid="crm-avl-tier">
              {AVL_TIER_LABEL[card.avlTier as AvlTier]}
              {typeof card.jevAvlFit === "number" ? ` · fit ${card.jevAvlFit}` : ""}
            </p>
          ) : null}
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
                  · {CRM_APP_LABEL[card.lastOutreach.app]} · {card.lastOutreach.dateOnly || !hasClockTime(card.lastOutreach.at) ? fmtLoggedDay(card.lastOutreach.at) : fmtDate(card.lastOutreach.at)}
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

      {isOwner ? <ChurchSignals signals={card.signals ?? []} /> : null}
      {isOwner ? <TechDirectorPeople people={card.contacts} card={card} canSave={canSave} /> : null}
      {isOwner && card.leadQueue && card.leadId ? (
        <SignalQueueActions leadId={card.leadId} city={card.org?.city ?? ""} state={card.org?.state || card.state || ""} />
      ) : null}
      <OrgTools card={card} canSave={canSave} onOpen={onOpenOrg} />
      <SuggestNextStep card={card} isOwner={isOwner} canSave={canSave} outreachHidden={outreachHidden} />
      <PeopleTools card={card} canSave={canSave} />

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

export function CrmDesk({ cards: sourceCards, followUps, adminUrls, canSave = false, isOwner = false, outreachHidden = false, topInitial = null, avInitial = null, techFirst = false, searchQuery = "", preview = "" }: Props) {
  const cards = useMemo(() => sourceCards.map(withOutreachLog), [sourceCards]);
  const [reason, setReason] = useState<FollowUpReason | "all">("all");
  const [filter, setFilter] = useState<CardFilter>(techFirst ? "tech" : "all");
  const [signalFilter, setSignalFilter] = useState<"" | typeof SIGNAL_STAFF | typeof SIGNAL_BUILDING>("");
  const [stateFilter, setStateFilter] = useState("");
  const [queueOnly, setQueueOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [focus, setFocus] = useState<string | null>(null);
  // Owner only: AV prospects or Top prospects show in place of the cards.
  const [panel, setPanel] = useState<"cards" | "av" | "top">(avInitial?.ok ? "av" : topInitial?.ok ? "top" : "cards");

  const todayRows = useMemo(() => followUps.filter((row) => row.today), [followUps]);
  const waitOnlyRows = useMemo(() => followUps.filter((row) => !row.today), [followUps]);

  // Counts are orgs/people, not reasons: one row per card.
  const reasonCounts = useMemo(() => {
    const counts = Object.fromEntries(REASONS.map((item) => [item, 0])) as Record<FollowUpReason, number>;
    for (const row of followUps) for (const item of row.reasons) counts[item] += 1;
    return counts;
  }, [followUps]);

  const filterCounts = useMemo(() => {
    const out = {} as Record<Exclude<CardFilter, "tech">, number>;
    for (const key of Object.keys(FILTER_LABEL) as Array<Exclude<CardFilter, "tech">>) out[key] = cards.filter((card) => matches(card, key)).length;
    return out;
  }, [cards]);
  const techCount = useMemo(() => cards.filter((card) => matches(card, "tech")).length, [cards]);
  const staffCount = useMemo(() => cards.filter((card) => (card.signals ?? []).some((signal) => signal.tag === SIGNAL_STAFF)).length, [cards]);
  const buildingCount = useMemo(() => cards.filter((card) => (card.signals ?? []).some((signal) => signal.tag === SIGNAL_BUILDING)).length, [cards]);
  const stateOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const card of cards) {
      const code = stateCode(card.state || card.town.split(",").pop() || "");
      if (code) codes.add(code);
    }
    return [...codes].sort();
  }, [cards]);

  const shownFollowUps = reason === "all" ? todayRows : followUps.filter((row) => row.reasons.includes(reason));

  const shownCards = useMemo(() => {
    if (focus) return cards.filter((card) => card.key === focus);
    const list = cards.filter((card) => {
      if (queueOnly && !card.leadQueue) return false;
      if (!matches(card, filter)) return false;
      if (signalFilter && !(card.signals ?? []).some((signal) => signal.tag === signalFilter)) return false;
      if (stateFilter && stateCode(card.state || card.town.split(",").pop() || "") !== stateFilter) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      const aScore = churchSignalScore(a.signals ?? [], signalFilter || undefined) ?? Number.NEGATIVE_INFINITY;
      const bScore = churchSignalScore(b.signals ?? [], signalFilter || undefined) ?? Number.NEGATIVE_INFINITY;
      if (aScore !== bScore) return bScore - aScore;
      return a.name.localeCompare(b.name);
    });
  }, [cards, filter, focus, signalFilter, stateFilter, queueOnly]);

  const openCard = (key: string) => {
    setPanel("cards");
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
        <ChipScroller label="Filter follow-ups">
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
        </ChipScroller>
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
          <div className="crm-search">
            {isOwner ? (
              <form action="/crm" method="get" className="crm-search-form">
                <span className="crm-sr-only">Search loaded churches by name, person, title, city, or tag</span>
                {preview ? <input type="hidden" name="preview" value={preview} /> : null}
                <input type="search" name="q" defaultValue={searchQuery} placeholder="Search loaded churches, people, cities, or tags" aria-label="Search loaded churches by name, person, title, city, or tag" />
                <button type="submit" className="dx-btn">
                  Search
                </button>
              </form>
            ) : null}
          </div>
        </div>
        <ChipScroller label="Filter cards">
          {(Object.keys(FILTER_LABEL) as Array<Exclude<CardFilter, "tech">>).map((key) => (
            <button
              type="button"
              key={key}
              className={`dx-chip crm-chip${panel === "cards" && !focus && filter === key ? " dx-chip--active" : ""}`}
              onClick={() => {
                setFilter(key);
                setSignalFilter("");
                setQueueOnly(false);
                setFocus(null);
                setPanel("cards");
                setLimit(PAGE);
              }}
              aria-pressed={panel === "cards" && !focus && filter === key}
            >
              {FILTER_LABEL[key]} <strong>{filterCounts[key]}</strong>
            </button>
          ))}
          {isOwner ? (
            <button
              type="button"
              className={`dx-chip crm-chip${panel === "cards" && !focus && filter === "tech" ? " dx-chip--active" : ""}`}
              onClick={() => {
                setFilter("tech");
                setSignalFilter("");
                setQueueOnly(false);
                setFocus(null);
                setPanel("cards");
                setLimit(PAGE);
              }}
              aria-pressed={panel === "cards" && !focus && filter === "tech"}
              data-testid="crm-tech-chip"
            >
              Technical director <strong>{techCount}</strong>
            </button>
          ) : null}
          {isOwner ? (
            <button
              type="button"
              className={`dx-chip crm-chip${panel === "cards" && !focus && signalFilter === SIGNAL_STAFF ? " dx-chip--active" : ""}`}
              onClick={() => {
                setFilter("all");
                setSignalFilter((current) => (current === SIGNAL_STAFF ? "" : SIGNAL_STAFF));
                setQueueOnly(false);
                setFocus(null);
                setPanel("cards");
                setLimit(PAGE);
              }}
              aria-pressed={panel === "cards" && !focus && signalFilter === SIGNAL_STAFF}
              data-testid="crm-signal-staff"
            >
              Technical/media staff <strong>{staffCount}</strong>
            </button>
          ) : null}
          {isOwner ? (
            <button
              type="button"
              className={`dx-chip crm-chip${panel === "cards" && !focus && signalFilter === SIGNAL_BUILDING ? " dx-chip--active" : ""}`}
              onClick={() => {
                setFilter("all");
                setSignalFilter((current) => (current === SIGNAL_BUILDING ? "" : SIGNAL_BUILDING));
                setQueueOnly(false);
                setFocus(null);
                setPanel("cards");
                setLimit(PAGE);
              }}
              aria-pressed={panel === "cards" && !focus && signalFilter === SIGNAL_BUILDING}
              data-testid="crm-signal-building"
            >
              Building investment <strong>{buildingCount}</strong>
            </button>
          ) : null}
          {isOwner ? (
            <button
              type="button"
              className={`dx-chip crm-chip${panel === "av" ? " dx-chip--active" : ""}`}
              onClick={() => {
                setPanel("av");
                setFocus(null);
              }}
              aria-pressed={panel === "av"}
              data-testid="crm-av-chip"
            >
              AV prospects
            </button>
          ) : null}
          {isOwner ? (
            <button
              type="button"
              className={`dx-chip crm-chip${panel === "top" ? " dx-chip--active" : ""}`}
              onClick={() => {
                setPanel("top");
                setFocus(null);
              }}
              aria-pressed={panel === "top"}
              data-testid="crm-top-chip"
            >
              Top prospects
            </button>
          ) : null}
          {isOwner ? (
            <button
              type="button"
              className={`dx-chip crm-chip${panel === "cards" && queueOnly ? " dx-chip--active" : ""}`}
              onClick={() => {
                setQueueOnly((current) => !current);
                setPanel("cards");
                setFocus(null);
                setLimit(PAGE);
              }}
              aria-pressed={panel === "cards" && queueOnly}
              data-testid="crm-lead-queue"
            >
              Lead queue <strong>{cards.filter((card) => card.leadQueue).length}</strong>
            </button>
          ) : null}
        </ChipScroller>
        {isOwner ? (
          <label className="crm-state-filter">
            <span>State</span>
            <select
              value={stateFilter}
              data-testid="crm-state-filter"
              onChange={(event) => {
                setStateFilter(event.target.value);
                setQueueOnly(false);
                setFocus(null);
                setPanel("cards");
                setLimit(PAGE);
              }}
            >
              <option value="">All states</option>
              {stateOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <details className="crm-legend">
          <summary>What the words mean</summary>
          <dl>
            <div><dt>Resting</dt><dd>An app reached out in the last 14 days and they have not replied. Wait until the date shown.</dd></div>
            <div><dt>Replied</dt><dd>They answered after our last reach-out, so it is fine to follow up now.</dd></div>
            <div><dt>Go gently</dt><dd>Fine to follow up, but we reached out recently or more than once, so keep it soft.</dd></div>
            <div><dt>Stop</dt><dd>Do not pitch: on the do-not-contact list, already a customer for that offer, or they said no.</dd></div>
            <div><dt>Possible match</dt><dd>Same name and town in another app. Not joined, so check before treating them as one.</dd></div>
            <div><dt>Matched by same website</dt><dd>Records joined into one card because they share a website (or a linked record, email, or phone).</dd></div>
            <div><dt>Technical director</dt><dd>A church contact with that role tag. The card shows their name, title, and the contact published for them.</dd></div>
            <div><dt>Technical/media staff</dt><dd>A church with a staff signal. The card shows the evidence quote and the source page.</dd></div>
            <div><dt>Building investment</dt><dd>A campaign or renovation on file. The card shows the evidence quote, source page, date, and score. No person is required.</dd></div>
            <div><dt>Lead queue</dt><dd>An unmatched church signal saved as a lead. Search finds it by church, person, city, or tag. Nothing is sent.</dd></div>
            <div><dt>Outreach log</dt><dd>A note and a day on a contact, plus a status: new, contacted, follow-up, meeting, won, or lost. Logging only.</dd></div>
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
        {panel === "av" ? (
          <AvProspects cards={cards} adminUrls={adminUrls} onOpen={openCard} initial={avInitial} />
        ) : panel === "top" ? (
          <TopProspects cards={cards} adminUrls={adminUrls} initial={topInitial} />
        ) : shownCards.length ? (
          <div className="crm-grid">
            {shownCards.slice(0, limit).map((card) => (
              <CardView card={card} adminUrls={adminUrls} key={card.key} open={Boolean(focus)} onOpen={openCard} onOpenOrg={openOrg} canSave={canSave} isOwner={isOwner} outreachHidden={outreachHidden} />
            ))}
          </div>
        ) : (
          <div className="crm-empty">
            <p>No cards match. Try another filter or clear the search.</p>
            <button
              type="button"
              className="dx-btn"
              onClick={() => {
                if (searchQuery) {
                  window.location.href = preview ? `/crm?preview=${encodeURIComponent(preview)}` : "/crm";
                  return;
                }
                setFilter("all");
                setSignalFilter("");
                setStateFilter("");
                setQueueOnly(false);
                setFocus(null);
                setPanel("cards");
              }}
            >
              Clear
            </button>
          </div>
        )}
        {panel === "cards" && shownCards.length > limit ? (
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
