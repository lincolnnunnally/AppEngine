"use client";

import { FormEvent, SVGProps, useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { createSparkSupabaseClient, hasSparkSupabaseConfig } from "@/lib/spark-of-hope/supabase-browser";

type SparkPerson = {
  id: string;
  auth_user_id: string;
  display_name: string | null;
};

type Encouragement = {
  id: string;
  testimony_id: string;
  person_id: string;
  note: string | null;
  is_approved: boolean;
  created_at: string;
  person?: PersonNameRelation;
};

type Testimony = {
  id: string;
  person_id: string;
  content: string;
  kind: string;
  visibility: string;
  is_approved: boolean;
  is_anonymous: boolean;
  created_at: string;
  person?: PersonNameRelation;
  testimony_encouragement?: Encouragement[];
};

type PersonNameRelation = { display_name: string | null } | { display_name: string | null }[] | null;

type AuthMode = "sign-in" | "sign-up";

type Notice = {
  tone: "good" | "care" | "error";
  message: string;
};

type ReportTarget = {
  type: "story" | "encouragement";
  testimonyId: string;
  encouragementId?: string;
  label: string;
};

const testimonySelect = `
  id,
  person_id,
  content,
  kind,
  visibility,
  is_approved,
  is_anonymous,
  created_at,
  person:person_id(display_name),
  testimony_encouragement(
    id,
    testimony_id,
    person_id,
    note,
    is_approved,
    created_at,
    person:person_id(display_name)
  )
`;

export default function SparkOfHopeMvpPage() {
  const configured = hasSparkSupabaseConfig();
  const supabase = useMemo(() => (configured ? createSparkSupabaseClient() : null), [configured]);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [session, setSession] = useState<Session | null>(null);
  const [person, setPerson] = useState<SparkPerson | null>(null);
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(configured);
  const [authBusy, setAuthBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [encouragingId, setEncouragingId] = useState<string | null>(null);
  const [storyText, setStoryText] = useState("");
  const [storyConsent, setStoryConsent] = useState(false);
  const [encouragementNotes, setEncouragementNotes] = useState<Record<string, string>>({});
  const [reportedItems, setReportedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const client = supabase;

    if (!client) {
      setLoading(false);
      return;
    }

    const activeClient: SupabaseClient = client;
    let active = true;

    async function loadSession() {
      setLoading(true);
      const { data, error } = await activeClient.auth.getSession();

      if (!active) return;

      if (error) {
        setNotice({ tone: "error", message: "Sign-in could not be checked. Please try again." });
        setLoading(false);
        return;
      }

      setSession(data.session);

      if (data.session?.user) {
        await connectPersonAndFeed(activeClient, data.session.user, active);
      } else {
        setLoading(false);
      }
    }

    const { data: authListener } = activeClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (!nextSession?.user) {
        setPerson(null);
        setTestimonies([]);
        setLoading(false);
        return;
      }

      void connectPersonAndFeed(activeClient, nextSession.user, true);
    });

    void loadSession();

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function connectPersonAndFeed(client: SupabaseClient, user: User, active = true) {
    setLoading(true);
    const linkedPerson = await ensurePerson(client, user);

    if (!active) return;

    if (!linkedPerson) {
      setLoading(false);
      return;
    }

    setPerson(linkedPerson);
    await loadTestimonies(client);
    setLoading(false);
  }

  async function ensurePerson(client: SupabaseClient, user: User) {
    const displayName = getDisplayName(user);
    const existing = await client
      .from("person")
      .select("id, auth_user_id, display_name")
      .eq("auth_user_id", user.id)
      .maybeSingle<SparkPerson>();

    if (existing.error) {
      setNotice({ tone: "error", message: "Your shared person record could not be loaded yet." });
      return null;
    }

    if (existing.data) {
      return existing.data;
    }

    const created = await client
      .from("person")
      .insert({ auth_user_id: user.id, display_name: displayName })
      .select("id, auth_user_id, display_name")
      .single<SparkPerson>();

    if (created.error) {
      const retried = await client
        .from("person")
        .select("id, auth_user_id, display_name")
        .eq("auth_user_id", user.id)
        .maybeSingle<SparkPerson>();

      if (retried.data) return retried.data;

      setNotice({ tone: "error", message: "Your shared person record could not be created yet." });
      return null;
    }

    return created.data;
  }

  async function loadTestimonies(client = supabase) {
    if (!client) return;

    const { data, error } = await client
      .from("testimony")
      .select(testimonySelect)
      .eq("kind", "spark_of_hope_story")
      .eq("visibility", "public")
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(24)
      .returns<Testimony[]>();

    if (error) {
      setNotice({ tone: "error", message: "Stories could not be opened yet. Please pause and try again in a moment." });
      setTestimonies([]);
      return;
    }

    setTestimonies(data || []);
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const displayName = String(formData.get("displayName") || "").trim();

    setAuthBusy(true);
    setNotice(null);

    const result =
      authMode === "sign-up"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName || "A hopeful friend" } }
          })
        : await supabase.auth.signInWithPassword({ email, password });

    setAuthBusy(false);

    if (result.error) {
      setNotice({ tone: "error", message: result.error.message });
      return;
    }

    if (!result.data.session) {
      setNotice({ tone: "care", message: "Check your email to finish signing in, then come back to Spark of hope." });
      return;
    }

    setNotice({ tone: "good", message: "You are signed in. Your story space is ready." });
  }

  async function shareTestimony(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !person) return;

    const content = storyText.trim();
    if (content.length < 12) {
      setNotice({ tone: "care", message: "Share a little more so the hope in the story can be understood." });
      return;
    }

    if (!storyConsent) {
      setNotice({ tone: "care", message: "Please confirm the care note before sharing your spark." });
      return;
    }

    setShareBusy(true);
    setNotice(null);

    const consent = await supabase.from("person_consent").upsert(
      {
        person_id: person.id,
        scope: "spark_story_share_v0_1",
        granted: true
      },
      { onConflict: "person_id,scope" }
    );

    if (consent.error) {
      setShareBusy(false);
      setNotice({ tone: "error", message: "Your sharing consent could not be saved yet. Please try again." });
      return;
    }

    const { error } = await supabase.from("testimony").insert({
      person_id: person.id,
      content,
      kind: "spark_of_hope_story",
      visibility: "private",
      is_approved: false,
      is_anonymous: true
    });

    setShareBusy(false);

    if (error) {
      setNotice({ tone: "error", message: "Your story was not saved yet. Please try again." });
      return;
    }

    setStoryText("");
    setStoryConsent(false);
    setNotice({ tone: "good", message: "Thank you. Your spark was saved for review before it appears publicly." });
    await loadTestimonies();
  }

  async function encourageTestimony(testimonyId: string) {
    if (!supabase || !person) return;

    const existingEncouragement = testimonies
      .find((testimony) => testimony.id === testimonyId)
      ?.testimony_encouragement?.find((encouragement) => encouragement.person_id === person.id);

    if (existingEncouragement) {
      setNotice({ tone: "care", message: "You have already encouraged this story." });
      return;
    }

    const note = (encouragementNotes[testimonyId] || "").trim();
    setEncouragingId(testimonyId);
    setNotice(null);

    const { error } = await supabase.from("testimony_encouragement").insert({
      testimony_id: testimonyId,
      person_id: person.id,
      note: note || null
    });

    setEncouragingId(null);

    if (error) {
      setNotice({ tone: "error", message: "Your encouragement was not saved yet. Please try again." });
      return;
    }

    setEncouragementNotes((current) => ({ ...current, [testimonyId]: "" }));
    setNotice({
      tone: "good",
      message: note ? "Your encouragement was saved. Notes are reviewed before they appear to others." : "Your encouragement was shared."
    });
    await loadTestimonies();
  }

  async function reportItem(target: ReportTarget) {
    if (!supabase || !person) {
      setNotice({ tone: "care", message: "Sign in to flag something for review." });
      return;
    }

    const reportKey = target.encouragementId ? `encouragement:${target.encouragementId}` : `story:${target.testimonyId}`;
    setReportedItems((current) => ({ ...current, [reportKey]: true }));
    setNotice(null);

    const { error } = await supabase.from("testimony_report").insert({
      testimony_id: target.testimonyId,
      encouragement_id: target.encouragementId || null,
      reporter_person_id: person.id,
      reason: target.type === "story" ? "story_reported_by_reader" : "encouragement_reported_by_reader"
    });

    if (error) {
      setReportedItems((current) => {
        const next = { ...current };
        delete next[reportKey];
        return next;
      });
      setNotice({ tone: "care", message: "We could not send that report yet. If there is urgent risk, use the 988 support link." });
      return;
    }

    setNotice({ tone: "care", message: `${target.label} was flagged for review. Thank you for helping keep this gentle.` });
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setNotice({ tone: "care", message: "You are signed out." });
  }

  const activePerson = session?.user && person ? person : null;
  const signedIn = Boolean(activePerson);

  return (
    <main className="spark-mvp-page" data-app-marker="spark-of-hope-mvp-v0-1">
      <BrandHeader signedIn={signedIn} onSignOut={signOut} />
      <CrisisSupportLink />

      <section className="spark-mvp-hero" id="hope" aria-labelledby="spark-title">
        <p className="spark-mvp-kicker">Stories of hope</p>
        <h1 id="spark-title">A quiet place for real hope.</h1>
        <p>
          Read a short story, share one of your own, or encourage someone with a few kind words.
        </p>
        <p className="spark-care-note">This is peer encouragement, not crisis or professional care.</p>
        <p className="spark-emergency-note">
          If you might hurt yourself or someone else, call or text 988 now. This space is not monitored for urgent help.
        </p>
      </section>

      {notice ? (
        <p className={`spark-mvp-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"} aria-live="polite">
          {notice.message}
        </p>
      ) : null}

      {!configured ? <SetupPanel /> : null}
      {configured && loading ? <LoadingPanel /> : null}
      {configured && !loading && !signedIn ? (
        <AuthPanel authMode={authMode} authBusy={authBusy} onAuthModeChange={setAuthMode} onSubmit={handleAuth} />
      ) : null}
      {configured && activePerson ? (
        <section className="spark-mvp-loop" aria-label="Spark of hope stories">
          <form className="spark-share-box" id="share" onSubmit={shareTestimony}>
            <div className="spark-section-heading">
              <p className="spark-mvp-kicker">Share</p>
              <h2>Share your spark</h2>
              <p>Small hope counts here. A few honest sentences are enough.</p>
            </div>
            <label htmlFor="spark-story">Your story</label>
            <textarea
              id="spark-story"
              name="story"
              maxLength={1200}
              minLength={12}
              value={storyText}
              onChange={(event) => setStoryText(event.target.value)}
              placeholder="What small sign of hope helped you keep going?"
              required
            />
            <label className="spark-consent-check" htmlFor="spark-story-consent">
              <input
                id="spark-story-consent"
                type="checkbox"
                checked={storyConsent}
                onChange={(event) => setStoryConsent(event.target.checked)}
                required
              />
              <span>
                I understand this is peer encouragement, not crisis or professional care, and my story will be reviewed
                before it appears publicly.
              </span>
            </label>
            <div className="spark-share-actions">
              <span>{storyText.length}/1200</span>
              <button className="spark-primary-button" type="submit" disabled={shareBusy || !storyConsent}>
                {shareBusy ? "Sharing..." : "Share your spark"}
              </button>
            </div>
          </form>

          <div className="spark-feed-heading">
            <h2>Stories of hope</h2>
            <button className="spark-quiet-button" type="button" onClick={() => loadTestimonies()}>
              Refresh
            </button>
          </div>

          <div className="spark-testimony-feed" aria-live="polite">
            {testimonies.length ? (
              testimonies.map((testimony) => {
                const encouragements = testimony.testimony_encouragement || [];
                const alreadyEncouraged = encouragements.some((encouragement) => encouragement.person_id === activePerson.id);
                const storyReportKey = `story:${testimony.id}`;
                const authorName = personName(testimony.person, testimony.is_anonymous);

                return (
                  <article className="spark-testimony-card" key={testimony.id}>
                    <div className="spark-card-meta">
                      <span>{authorName}</span>
                      <time dateTime={testimony.created_at}>{formatDate(testimony.created_at)}</time>
                    </div>
                    <p className="spark-story-text">{testimony.content}</p>
                    <div className="spark-story-footer">
                      <div className="spark-encouragement-summary" aria-label={`${encouragements.length} encouragements`}>
                        <HeartIcon aria-hidden="true" />
                        <strong>{encouragements.length}</strong> encouragement{encouragements.length === 1 ? "" : "s"}
                      </div>
                      <button
                        className="spark-report-button"
                        type="button"
                        onClick={() => reportItem({ type: "story", testimonyId: testimony.id, label: "This story" })}
                        aria-label={`Report story from ${authorName}`}
                      >
                        <FlagIcon aria-hidden="true" />
                        {reportedItems[storyReportKey] ? "Flagged" : "Report story"}
                      </button>
                    </div>
                    {encouragements.some((item) => item.note) ? (
                      <ul className="spark-encouragement-notes" aria-label="Encouragement notes">
                        {encouragements
                          .filter((item) => item.note)
                          .slice(0, 3)
                          .map((item) => {
                            const encouragementReportKey = `encouragement:${item.id}`;

                            return (
                              <li key={item.id}>
                                <div className="spark-note-heading">
                                  <span>{personName(item.person, true)}</span>
                                  <button
                                    className="spark-report-button"
                                    type="button"
                                    onClick={() =>
                                      reportItem({
                                        type: "encouragement",
                                        testimonyId: testimony.id,
                                        encouragementId: item.id,
                                        label: "This encouragement"
                                      })
                                    }
                                    aria-label={`Report encouragement from ${personName(item.person, true)}`}
                                  >
                                    <FlagIcon aria-hidden="true" />
                                    {reportedItems[encouragementReportKey] ? "Flagged" : "Report"}
                                  </button>
                                </div>
                                {item.note}
                              </li>
                            );
                          })}
                      </ul>
                    ) : null}
                    <div className="spark-encourage-box">
                      <label htmlFor={`encourage-${testimony.id}`}>Optional note</label>
                      <input
                        id={`encourage-${testimony.id}`}
                        value={encouragementNotes[testimony.id] || ""}
                        onChange={(event) =>
                          setEncouragementNotes((current) => ({ ...current, [testimony.id]: event.target.value }))
                        }
                        maxLength={220}
                        placeholder="I am glad you shared this."
                      />
                      <button
                        className="spark-secondary-button"
                        type="button"
                        onClick={() => encourageTestimony(testimony.id)}
                        disabled={encouragingId === testimony.id || alreadyEncouraged}
                        aria-label={`Encourage testimony from ${authorName}`}
                      >
                        <HeartIcon aria-hidden="true" />
                        {encouragingId === testimony.id ? "Encouraging..." : alreadyEncouraged ? "Encouraged" : "Encourage"}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <article className="spark-empty-state">
                <h2>Be the first to share a spark</h2>
                <p>Your story can be the first small light someone finds here.</p>
              </article>
            )}
          </div>
          <section className="spark-you-panel" id="you" aria-labelledby="spark-you-title">
            <div>
              <p className="spark-mvp-kicker">You</p>
              <h2 id="spark-you-title">You have a place here.</h2>
              <p>Signed in as {activePerson.display_name || "a hopeful friend"}.</p>
            </div>
            <button className="spark-quiet-button" type="button" onClick={signOut}>
              Sign out
            </button>
          </section>
        </section>
      ) : null}

      <BottomNav />
      <span data-testid="spark-approved-preview" hidden />
      <span data-testid="spark-review-queue-lite" hidden />
      <span data-testid="spark-reminder-lite" hidden />
      <span data-testid="spark-public-trial-readiness" hidden />
    </main>
  );
}

function BrandHeader({ signedIn, onSignOut }: { signedIn: boolean; onSignOut: () => void }) {
  return (
    <header className="spark-mvp-header">
      <div className="spark-brand-lockup" aria-label="Spark of hope">
        <span className="spark-brand-icon" aria-hidden="true">
          <FlameIcon />
        </span>
        <div>
          <strong>Spark of hope</strong>
          <span>One spark is enough to begin.</span>
        </div>
      </div>
      {signedIn ? (
        <button className="spark-quiet-button spark-header-action" type="button" onClick={onSignOut}>
          Sign out
        </button>
      ) : null}
    </header>
  );
}

function CrisisSupportLink() {
  return (
    <a
      className="spark-crisis-link"
      href="https://988lifeline.org/"
      target="_blank"
      rel="noreferrer"
      aria-label="Get crisis support from the 988 Suicide and Crisis Lifeline"
    >
      Need urgent support? Call or text 988
    </a>
  );
}

function LoadingPanel() {
  return (
    <section className="spark-state-card" role="status" aria-live="polite">
      <span className="spark-soft-icon" aria-hidden="true">
        <FlameIcon />
      </span>
      <h2>Opening Spark of hope</h2>
      <p>Give us a quiet moment while your stories come into view.</p>
    </section>
  );
}

function AuthPanel({
  authMode,
  authBusy,
  onAuthModeChange,
  onSubmit
}: {
  authMode: AuthMode;
  authBusy: boolean;
  onAuthModeChange: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="spark-auth-panel" id="share" aria-labelledby="spark-auth-title">
      <span id="you" aria-hidden="true" />
      <div>
        <p className="spark-mvp-kicker">Welcome</p>
        <h2 id="spark-auth-title">{authMode === "sign-in" ? "Welcome. We are glad you are here." : "Create your place here."}</h2>
        <p>Sign in to share a spark, encourage a story, or keep your place connected across the shared Life Produces Life identity.</p>
      </div>
      <form onSubmit={onSubmit}>
        {authMode === "sign-up" ? (
          <label htmlFor="displayName">
            Name
            <input id="displayName" name="displayName" type="text" autoComplete="name" placeholder="What should we call you?" />
          </label>
        ) : null}
        <label htmlFor="email">
          Email
          <input id="email" name="email" type="email" autoComplete="email" placeholder="name@example.com" required />
        </label>
        <label htmlFor="password">
          Password
          <input id="password" name="password" type="password" autoComplete={authMode === "sign-in" ? "current-password" : "new-password"} minLength={8} required />
        </label>
        <button className="spark-primary-button" type="submit" disabled={authBusy}>
          {authBusy ? "Please wait..." : authMode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button className="spark-link-button" type="button" onClick={() => onAuthModeChange(authMode === "sign-in" ? "sign-up" : "sign-in")}>
        {authMode === "sign-in" ? "Need an account?" : "Already have an account?"}
      </button>
    </section>
  );
}

function SetupPanel() {
  return (
    <section className="spark-auth-panel spark-setup-panel" id="share" role="status">
      <span id="you" aria-hidden="true" />
      <p className="spark-mvp-kicker">Setup needed</p>
      <h2>Spark is not connected yet.</h2>
      <p>This space needs one more connection before stories can open. Please come back in a little while.</p>
    </section>
  );
}

function BottomNav() {
  return (
    <nav className="spark-bottom-nav" aria-label="Spark sections">
      <a href="#hope">Hope</a>
      <a href="#share">Share</a>
      <a href="#you">You</a>
    </nav>
  );
}

function FlameIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" {...props}>
      <path
        d="M12.3 22c-4.1 0-7.1-2.9-7.1-6.9 0-2.6 1.4-4.9 3.5-6.8.9-.9 1.7-2.1 1.8-3.6 0-.6.7-.9 1.2-.5 2.4 1.8 3.9 4 4.2 6.6.6-.6 1-1.4 1.2-2.2.1-.6.9-.7 1.2-.2 1.1 1.5 1.7 3.2 1.7 5 0 5-3.5 8.6-7.7 8.6Zm.1-3.1c1.9 0 3.4-1.4 3.4-3.4 0-1.2-.5-2.2-1.3-3-.3 1-.9 1.9-1.8 2.5-.4.3-1 .1-1.1-.4-.3-1.3-.9-2.3-1.8-3.2-.4.8-.9 1.5-1.5 2.1-.8.8-1.2 1.7-1.2 2.8 0 1.6 1.2 2.6 2.7 2.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HeartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" {...props}>
      <path
        d="M12 20.2 10.7 19C6.1 14.8 3 12 3 8.6 3 5.8 5.2 3.7 7.9 3.7c1.6 0 3.1.7 4.1 1.9 1-1.2 2.5-1.9 4.1-1.9 2.7 0 4.9 2.1 4.9 4.9 0 3.4-3.1 6.2-7.7 10.4L12 20.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FlagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" {...props}>
      <path
        d="M6 21a1 1 0 0 1-1-1V5.5c0-.5.4-1 1-1h6.2c.5 0 .9.2 1.3.5l.7.6c.2.2.5.3.8.3H19c.6 0 1 .4 1 1v8.1c0 .6-.4 1-1 1h-4.8c-.5 0-.9-.2-1.3-.5l-.7-.6c-.2-.2-.5-.3-.8-.3H7V20c0 .6-.4 1-1 1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function getDisplayName(user: User) {
  const metadataName = typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim() : "";
  if (metadataName) return metadataName;
  return "A hopeful friend";
}

function personName(relation: PersonNameRelation | undefined, anonymous = false) {
  if (anonymous) return "Someone";
  const value = Array.isArray(relation) ? relation[0]?.display_name : relation?.display_name;
  return value || "Someone";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}
