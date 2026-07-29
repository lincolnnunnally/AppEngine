"use client";

import { useState } from "react";

// The whole journey after the landing box, on one screen that changes shape as the
// case moves. There is no navigation, no settings, and nothing to learn — the
// screen only ever shows the one thing that is actually theirs to do next.

export type CaseBundle = {
  case: {
    token: string;
    state: string;
    statusLine: string;
    statedProblem: string | null;
    reflection: string | null;
    offer: {
      headline: string;
      whatWeBuild: string;
      whatItCosts: string;
      whatYouBring: string | null;
      readyBy: string;
      bullets: string[];
    } | null;
    readyBy: string | null;
    artifactUrl: string | null;
    walkthroughUrl: string | null;
    contactName: string | null;
    contactEmail: string | null;
    region: string | null;
    needsContact: boolean;
    safetyFlagged: boolean;
    safetyCategory: string | null;
    crisisResources: { name: string; contact: string; detail: string }[];
    escalationMessage: string | null;
    exchangeCount: number;
  };
  messages: { role: string; body: string; turnIndex: number; reflecting: boolean }[];
  covenant: {
    weBring: string[];
    theyBring: string;
    firstStep: string;
    agreed: boolean;
    declined: boolean;
    encouragement: string;
    kept: number;
    currentStreak: number;
    stalled: boolean;
    commitments: { periodIndex: number; description: string; dueOn: string; status: string }[];
  } | null;
  intro: {
    draft: string;
    matchName: string | null;
    state: string;
    awaitingYou: boolean;
    awaitingThem: boolean;
    attempt: number;
  } | null;
  followUp: { dueAt: string; answered: boolean } | null;
  assumptions: {
    id: string;
    question: string;
    assumed: string;
    rationale: string | null;
    status: string;
    correctedTo: string | null;
  }[];
  acceptance: {
    steps: { stepIndex: number; description: string; status: string }[];
    passing: number;
    total: number;
    deliverable: boolean;
  };
};

type Action = Record<string, unknown> & { action: string };

export default function CaseFlow({ initial }: { initial: CaseBundle }) {
  const [bundle, setBundle] = useState<CaseBundle>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: Action) {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/solve/cases/${bundle.case.token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action)
      });

      const payload = (await response.json()) as { ok?: boolean; message?: string } & Partial<CaseBundle>;

      if (!payload.ok || !payload.case) {
        setError(payload.message || "Something went wrong. Try again.");
        return;
      }

      setBundle(payload as CaseBundle);
    } catch {
      setError("Couldn't reach us just then. Nothing you typed was lost — try again.");
    } finally {
      setBusy(false);
    }
  }

  const { case: theCase } = bundle;

  // §4d — everything else stops.
  if (theCase.safetyFlagged) {
    return <Escalation bundle={bundle} />;
  }

  return (
    <div>
      {error ? <p className="se-error">{error}</p> : null}

      {(theCase.state === "intake" || theCase.state === "reflected") && (
        <Conversation bundle={bundle} busy={busy} send={send} />
      )}

      {theCase.state === "offered" && <OfferScreen bundle={bundle} busy={busy} send={send} />}
      {theCase.state === "covenant_pending" && <CovenantScreen bundle={bundle} busy={busy} send={send} />}
      {(theCase.state === "accepted" || theCase.state === "building") && <WaitingScreen bundle={bundle} busy={busy} send={send} />}
      {theCase.state === "delivered_pending_connection" && <DeliveredScreen bundle={bundle} />}
      {theCase.state === "connecting" && <IntroScreen bundle={bundle} busy={busy} send={send} />}
      {(theCase.state === "connected" || theCase.state === "follow_up") && <FollowUpScreen bundle={bundle} busy={busy} send={send} />}
      {theCase.state === "closed" && <ClosedScreen bundle={bundle} />}
      {theCase.state === "declined" && <DeclinedScreen bundle={bundle} busy={busy} send={send} />}
      {theCase.state === "paused" && <PausedScreen bundle={bundle} busy={busy} send={send} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Escalation({ bundle }: { bundle: CaseBundle }) {
  return (
    <div className="se-card se-alarm-card">
      <p style={{ fontSize: 19 }}>{bundle.case.escalationMessage}</p>
      <ul className="se-flatlist">
        {bundle.case.crisisResources.map((resource) => (
          <li key={resource.name} className="se-resource">
            <strong>{resource.contact}</strong>
            <span className="se-quiet">
              {resource.name} &mdash; {resource.detail}
            </span>
          </li>
        ))}
      </ul>
      <hr className="se-divider" />
      <p className="se-quiet">
        Someone here has been told, and a real person will reach out. We&rsquo;re not going to hand you a tool for this.
      </p>
    </div>
  );
}

function Conversation({ bundle, busy, send }: { bundle: CaseBundle; busy: boolean; send: (action: Action) => void }) {
  const [text, setText] = useState("");
  const reflecting = bundle.case.state === "reflected";

  return (
    <div>
      <div className="se-thread">
        {bundle.messages.map((message) => (
          <div key={message.turnIndex} className={`se-bubble ${message.role === "guide" ? "se-guide" : "se-person"}`}>
            {message.body}
          </div>
        ))}
        {busy ? <p className="se-typing">…</p> : null}
      </div>

      {reflecting ? (
        // "Reflect before proposing." The yes is load-bearing — nothing is offered
        // until they give it.
        <div className="se-row">
          <button className="se-button" disabled={busy} onClick={() => send({ action: "reflection", confirmed: true })}>
            Yes, that&rsquo;s it
          </button>
          <button
            className="se-button se-secondary"
            disabled={busy}
            onClick={() => send({ action: "reflection", confirmed: false })}
          >
            Not quite
          </button>
        </div>
      ) : (
        <form
          className="se-stack"
          onSubmit={(event) => {
            event.preventDefault();

            if (!text.trim()) {
              return;
            }

            send({ action: "reply", text });
            setText("");
          }}
        >
          <textarea
            className="se-field"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type here…"
            aria-label="Your reply"
            maxLength={4000}
          />
          <div className="se-row">
            <button className="se-button" type="submit" disabled={busy || !text.trim()}>
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function OfferScreen({ bundle, busy, send }: { bundle: CaseBundle; busy: boolean; send: (action: Action) => void }) {
  const offer = bundle.case.offer;
  const [name, setName] = useState(bundle.case.contactName || "");
  const [email, setEmail] = useState(bundle.case.contactEmail || "");
  const [region, setRegion] = useState(bundle.case.region || "");
  const [saved, setSaved] = useState(!bundle.case.needsContact);

  if (!offer) {
    return null;
  }

  return (
    <div>
      <span className="se-tag">Here&rsquo;s the offer</span>
      <h1 style={{ marginTop: 14 }}>{offer.headline}</h1>
      <p>{offer.whatWeBuild}</p>

      <div className="se-card">
        <h3>What you get</h3>
        <ul className="se-list">
          {offer.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        <hr className="se-divider" />
        <h3>What it costs</h3>
        <p style={{ margin: 0 }}>{offer.whatItCosts}</p>
        {offer.whatYouBring ? (
          <>
            <hr className="se-divider" />
            <h3>What you bring</h3>
            <p style={{ margin: 0 }}>{offer.whatYouBring}</p>
          </>
        ) : null}
        <hr className="se-divider" />
        <h3>Ready by</h3>
        <p style={{ margin: 0 }}>{offer.readyBy}</p>
      </div>

      <AcceptanceList bundle={bundle} busy={busy} send={send} editable />
      <AssumptionList bundle={bundle} busy={busy} send={send} />

      <div className="se-card">
        <h3>Where do we send it?</h3>
        <div className="se-stack">
          <input
            className="se-field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            aria-label="Your name"
          />
          <input
            className="se-field"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            type="email"
            aria-label="Email"
          />
          <input
            className="se-field"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            placeholder="Town or city (so we can find someone near you)"
            aria-label="Town or city"
          />
          <div className="se-row">
            <button
              className="se-button se-secondary"
              disabled={busy || !email.trim()}
              onClick={() => {
                send({ action: "contact", name, email, region });
                setSaved(true);
              }}
            >
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="se-row">
        <button className="se-button" disabled={busy || !saved} onClick={() => send({ action: "accept-offer" })}>
          Yes, build it
        </button>
        <button className="se-button se-quietbtn" disabled={busy} onClick={() => send({ action: "decline-offer" })}>
          Not right now
        </button>
      </div>
    </div>
  );
}

// The list that is simultaneously the spec, the test, and the manual. A person
// rewriting a line HERE costs one tap. The same correction after the build costs a
// week — which is the entire reason this screen exists.
function AcceptanceList({
  bundle,
  busy,
  send,
  editable
}: {
  bundle: CaseBundle;
  busy: boolean;
  send: (action: Action) => void;
  editable?: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  if (bundle.acceptance.total === 0) {
    return null;
  }

  return (
    <div className="se-card">
      <h3>When it&rsquo;s done, you&rsquo;ll be able to</h3>
      <ul className="se-flatlist">
        {bundle.acceptance.steps.map((step) => (
          <li key={step.stepIndex} className={`se-check ${step.status === "passing" ? "se-passing" : ""}`}>
            <span className="se-check-mark" aria-hidden="true">
              {step.status === "passing" ? "✓" : ""}
            </span>
            <span style={{ flex: 1 }}>
              {editing === step.stepIndex ? (
                <span className="se-stack">
                  <textarea
                    className="se-field"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    aria-label="Change this line"
                    maxLength={300}
                  />
                  <span className="se-row">
                    <button
                      className="se-button se-secondary"
                      disabled={busy || !draft.trim()}
                      onClick={() => {
                        send({ action: "revise", checkStepIndex: step.stepIndex, description: draft });
                        setEditing(null);
                      }}
                    >
                      Save this line
                    </button>
                    <button className="se-button se-quietbtn" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </span>
                </span>
              ) : (
                <>
                  {step.description}
                  {editable ? (
                    <button
                      className="se-button se-quietbtn"
                      onClick={() => {
                        setEditing(step.stepIndex);
                        setDraft(step.description);
                      }}
                    >
                      change
                    </button>
                  ) : null}
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="se-quiet" style={{ marginTop: 14, marginBottom: 0 }}>
        {editable
          ? "If a line is wrong, change it now — that's much easier than changing it after."
          : `${bundle.acceptance.passing} of ${bundle.acceptance.total} checked and working.`}
      </p>
    </div>
  );
}

// What we decided without stopping to ask. Shown plainly, with a way to overturn
// any of it — because the alternative is a question that costs a day.
function AssumptionList({ bundle, busy, send }: { bundle: CaseBundle; busy: boolean; send: (action: Action) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (bundle.assumptions.length === 0) {
    return null;
  }

  return (
    <div className="se-card">
      <h3>What we decided for you</h3>
      <p className="se-quiet">
        Rather than send you a list of questions, we picked the most likely answer to each one. Change any of them.
      </p>
      <ul className="se-flatlist">
        {bundle.assumptions.map((assumption) => (
          <li key={assumption.id}>
            <strong style={{ display: "block" }}>{assumption.correctedTo || assumption.assumed}</strong>
            <span className="se-quiet">{assumption.rationale}</span>
            {openId === assumption.id ? (
              <span className="se-stack" style={{ marginTop: 10 }}>
                <textarea
                  className="se-field"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="What should it be instead?"
                  aria-label="What should it be instead?"
                  maxLength={500}
                />
                <span className="se-row">
                  <button
                    className="se-button se-secondary"
                    disabled={busy || !draft.trim()}
                    onClick={() => {
                      send({ action: "revise", assumptionId: assumption.id, correctedTo: draft });
                      setOpenId(null);
                      setDraft("");
                    }}
                  >
                    Use this instead
                  </button>
                  <button className="se-button se-quietbtn" onClick={() => setOpenId(null)}>
                    Cancel
                  </button>
                </span>
              </span>
            ) : (
              <button className="se-button se-quietbtn" onClick={() => setOpenId(assumption.id)}>
                change this
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CovenantScreen({ bundle, busy, send }: { bundle: CaseBundle; busy: boolean; send: (action: Action) => void }) {
  const covenant = bundle.covenant;

  if (!covenant) {
    return null;
  }

  return (
    <div>
      <h1>One thing before we start.</h1>
      <p className="se-lede">This only works if we both show up. Here&rsquo;s the deal, in plain words.</p>

      <div className="se-card">
        <h3>What we bring</h3>
        <ul className="se-list">
          {covenant.weBring.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <hr className="se-divider" />
        <h3>What you bring</h3>
        <p>{covenant.theyBring}</p>
        <h3>Starting with</h3>
        <p style={{ margin: 0 }}>{covenant.firstStep}</p>
        <p className="se-quiet" style={{ marginTop: 10, marginBottom: 0 }}>
          Under an hour. That&rsquo;s the whole first ask.
        </p>
      </div>

      <div className="se-row">
        <button className="se-button" disabled={busy} onClick={() => send({ action: "sign-covenant" })}>
          I&rsquo;m in
        </button>
        <button className="se-button se-quietbtn" disabled={busy} onClick={() => send({ action: "refuse-covenant" })}>
          Not this
        </button>
      </div>
    </div>
  );
}

function WaitingScreen({ bundle, busy, send }: { bundle: CaseBundle; busy: boolean; send: (action: Action) => void }) {
  const covenant = bundle.covenant;
  const nextCommitment = covenant?.commitments.find((commitment) => commitment.status === "pending");

  return (
    <div>
      <h1>Come back {bundle.case.offer?.readyBy || "Thursday"}.</h1>
      <p className="se-lede">{bundle.case.statusLine} We&rsquo;ll email you the moment it&rsquo;s ready.</p>

      <AcceptanceList bundle={bundle} busy={busy} send={send} />

      {covenant?.agreed && nextCommitment ? (
        <div className="se-card">
          <h3>Your part, this week</h3>
          <p>{nextCommitment.description}</p>
          <p className="se-quiet">{covenant.encouragement}</p>
          <div className="se-row">
            <button
              className="se-button"
              disabled={busy}
              onClick={() => send({ action: "commitment", periodIndex: nextCommitment.periodIndex, status: "kept" })}
            >
              Did it
            </button>
            <button
              className="se-button se-secondary"
              disabled={busy}
              onClick={() => send({ action: "commitment", periodIndex: nextCommitment.periodIndex, status: "shrunk" })}
            >
              Make it smaller
            </button>
            <button
              className="se-button se-quietbtn"
              disabled={busy}
              onClick={() => send({ action: "commitment", periodIndex: nextCommitment.periodIndex, status: "missed" })}
            >
              Not this week
            </button>
          </div>
          {covenant.stalled ? (
            <p className="se-quiet" style={{ marginTop: 14 }}>
              Two weeks have gone by, and that usually means the step is too big &mdash; not that you&rsquo;re not trying.
              Shrink it and it still counts.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DeliveredScreen({ bundle }: { bundle: CaseBundle }) {
  return (
    <div>
      <h1>It&rsquo;s ready.</h1>
      <div className="se-card">
        <div className="se-stack">
          {bundle.case.artifactUrl ? (
            <a className="se-button" href={bundle.case.artifactUrl} target="_blank" rel="noreferrer">
              Open your thing
            </a>
          ) : null}
          {bundle.case.walkthroughUrl ? (
            <a className="se-button se-secondary" href={bundle.case.walkthroughUrl} target="_blank" rel="noreferrer">
              Watch the ten-minute walkthrough
            </a>
          ) : null}
        </div>
        <p className="se-quiet" style={{ marginTop: 16, marginBottom: 0 }}>
          That walkthrough is the whole manual. There&rsquo;s nothing to install and no account to keep up with.
        </p>
      </div>

      <div className="se-card">
        <h2>One more thing.</h2>
        <p style={{ marginBottom: 0 }}>
          We&rsquo;re looking for someone who&rsquo;s been exactly where you are. When we find them, this page will
          tell you &mdash; and we&rsquo;ll email you too.
        </p>
      </div>
    </div>
  );
}

function IntroScreen({ bundle, busy, send }: { bundle: CaseBundle; busy: boolean; send: (action: Action) => void }) {
  const intro = bundle.intro;

  if (!intro) {
    return (
      <div className="se-card">
        <h2>Looking for the right person.</h2>
        <p style={{ marginBottom: 0 }}>We&rsquo;ll tell you the moment we find them.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>You should meet {intro.matchName}.</h1>
      <div className="se-card">
        <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{intro.draft}</p>
      </div>

      {intro.awaitingYou ? (
        <div className="se-row">
          <button className="se-button" disabled={busy} onClick={() => send({ action: "intro", accept: true })}>
            Yes, introduce us
          </button>
          <button className="se-button se-quietbtn" disabled={busy} onClick={() => send({ action: "intro", accept: false })}>
            No thanks
          </button>
        </div>
      ) : (
        <p className="se-quiet">
          You said yes. We&rsquo;ve asked {intro.matchName} &mdash; nothing gets shared until they say yes too.
        </p>
      )}
    </div>
  );
}

function FollowUpScreen({ bundle, busy, send }: { bundle: CaseBundle; busy: boolean; send: (action: Action) => void }) {
  const [stillWorking, setStillWorking] = useState<boolean | null>(null);
  const [stillMeeting, setStillMeeting] = useState<boolean | null>(null);
  const [testimony, setTestimony] = useState("");

  if (bundle.followUp?.answered) {
    return <ClosedScreen bundle={bundle} />;
  }

  return (
    <div>
      <h1>Two quick questions.</h1>
      <div className="se-card">
        <h3>Is the thing we built still working for you?</h3>
        <div className="se-row">
          <button
            className={`se-button ${stillWorking === true ? "" : "se-secondary"}`}
            disabled={busy}
            onClick={() => setStillWorking(true)}
          >
            Still using it
          </button>
          <button
            className={`se-button ${stillWorking === false ? "" : "se-secondary"}`}
            disabled={busy}
            onClick={() => setStillWorking(false)}
          >
            Stopped working
          </button>
        </div>

        <hr className="se-divider" />

        <h3>Still in touch with the person we introduced you to?</h3>
        <div className="se-row">
          <button
            className={`se-button ${stillMeeting === true ? "" : "se-secondary"}`}
            disabled={busy}
            onClick={() => setStillMeeting(true)}
          >
            Yes
          </button>
          <button
            className={`se-button ${stillMeeting === false ? "" : "se-secondary"}`}
            disabled={busy}
            onClick={() => setStillMeeting(false)}
          >
            No
          </button>
        </div>

        <hr className="se-divider" />

        <h3>Anything you want to say? (optional)</h3>
        <textarea
          className="se-field"
          value={testimony}
          onChange={(event) => setTestimony(event.target.value)}
          placeholder="Only if you feel like it."
          aria-label="Anything you want to say"
          maxLength={2000}
        />

        <div className="se-row" style={{ marginTop: 16 }}>
          <button
            className="se-button"
            disabled={busy || stillWorking === null || stillMeeting === null}
            onClick={() =>
              send({
                action: "follow-up",
                stillWorking: stillWorking === true,
                stillMeeting: stillMeeting === true,
                testimony
              })
            }
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function ClosedScreen({ bundle }: { bundle: CaseBundle }) {
  return (
    <div className="se-card">
      <h2>That&rsquo;s us done &mdash; and the door stays open.</h2>
      <p>
        If the thing stops working, don&rsquo;t fight with it. Tell us and we&rsquo;ll build you a new one.
      </p>
      <p style={{ marginBottom: 0 }} className="se-quiet">
        {bundle.case.statusLine}
      </p>
    </div>
  );
}

function DeclinedScreen({ bundle, busy, send }: { bundle: CaseBundle; busy: boolean; send: (action: Action) => void }) {
  return (
    <div className="se-card">
      <h2>Nothing owed.</h2>
      <p>
        {bundle.case.statusLine} If you ever want to pick it up, it&rsquo;s exactly where you left it.
      </p>
      <button className="se-button se-secondary" disabled={busy} onClick={() => send({ action: "refresh" })}>
        Check again
      </button>
    </div>
  );
}

function PausedScreen({ bundle, busy, send }: { bundle: CaseBundle; busy: boolean; send: (action: Action) => void }) {
  const [text, setText] = useState("");

  return (
    <div>
      <h2>This is here whenever you&rsquo;re ready.</h2>
      <p className="se-lede">{bundle.case.statusLine}</p>
      <form
        className="se-stack"
        onSubmit={(event) => {
          event.preventDefault();

          if (!text.trim()) {
            return;
          }

          send({ action: "reply", text });
          setText("");
        }}
      >
        <textarea
          className="se-field"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Pick it up here."
          aria-label="Pick it up here"
        />
        <div className="se-row">
          <button className="se-button" type="submit" disabled={busy || !text.trim()}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
