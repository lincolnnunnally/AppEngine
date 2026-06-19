"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  created_at: string;
  person?: PersonNameRelation;
};

type Testimony = {
  id: string;
  person_id: string;
  content: string;
  kind: string;
  visibility: string;
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

const testimonySelect = `
  id,
  person_id,
  content,
  kind,
  visibility,
  created_at,
  person:person_id(display_name),
  testimony_encouragement(
    id,
    testimony_id,
    person_id,
    note,
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
  const [encouragementNotes, setEncouragementNotes] = useState<Record<string, string>>({});

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
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(24)
      .returns<Testimony[]>();

    if (error) {
      setNotice({ tone: "error", message: "Stories could not be loaded. The shared Supabase schema may need the Spark MVP migration." });
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
            options: { data: { display_name: displayName || email.split("@")[0] } }
          })
        : await supabase.auth.signInWithPassword({ email, password });

    setAuthBusy(false);

    if (result.error) {
      setNotice({ tone: "error", message: result.error.message });
      return;
    }

    if (!result.data.session) {
      setNotice({ tone: "care", message: "Check your email to finish signing in, then come back to Spark of Hope." });
      return;
    }

    setNotice({ tone: "good", message: "You are signed in. Your stories are tied to your shared person identity." });
  }

  async function shareTestimony(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !person) return;

    const content = storyText.trim();
    if (content.length < 12) {
      setNotice({ tone: "care", message: "Share a little more so the hope in the story can be understood." });
      return;
    }

    setShareBusy(true);
    setNotice(null);

    const { error } = await supabase.from("testimony").insert({
      person_id: person.id,
      content,
      kind: "spark_of_hope_story",
      visibility: "public"
    });

    setShareBusy(false);

    if (error) {
      setNotice({ tone: "error", message: "Your story was not saved yet. Please try again." });
      return;
    }

    setStoryText("");
    setNotice({ tone: "good", message: "Thank you for sharing that spark of hope." });
    await loadTestimonies();
  }

  async function encourageTestimony(testimonyId: string) {
    if (!supabase || !person) return;

    const note = (encouragementNotes[testimonyId] || "").trim();
    setEncouragingId(testimonyId);
    setNotice(null);

    const { error } = await supabase
      .from("testimony_encouragement")
      .upsert(
        {
          testimony_id: testimonyId,
          person_id: person.id,
          note: note || null
        },
        { onConflict: "testimony_id,person_id" }
      );

    setEncouragingId(null);

    if (error) {
      setNotice({ tone: "error", message: "Your encouragement was not saved yet. Please try again." });
      return;
    }

    setEncouragementNotes((current) => ({ ...current, [testimonyId]: "" }));
    setNotice({ tone: "good", message: "Your encouragement was shared." });
    await loadTestimonies();
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
      <header className="spark-mvp-header">
        <Link href="/" className="spark-mvp-back">
          App Engine
        </Link>
        {signedIn ? (
          <button className="spark-quiet-button" type="button" onClick={signOut}>
            Sign out
          </button>
        ) : null}
      </header>

      <section className="spark-mvp-hero" aria-labelledby="spark-title">
        <p className="spark-mvp-kicker">Spark of Hope</p>
        <h1 id="spark-title">A quiet place for real hope.</h1>
        <p>
          Read a short story, share one of your own, or encourage someone with a few kind words.
        </p>
      </section>

      {notice ? (
        <p className={`spark-mvp-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"} aria-live="polite">
          {notice.message}
        </p>
      ) : null}

      {!configured ? <SetupPanel /> : null}
      {configured && loading ? <p className="spark-mvp-loading">Opening Spark of Hope...</p> : null}
      {configured && !loading && !signedIn ? (
        <AuthPanel authMode={authMode} authBusy={authBusy} onAuthModeChange={setAuthMode} onSubmit={handleAuth} />
      ) : null}
      {configured && activePerson ? (
        <section className="spark-mvp-loop" aria-label="Spark of Hope stories">
          <form className="spark-share-box" onSubmit={shareTestimony}>
            <label htmlFor="spark-story">Share a testimony</label>
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
            <div className="spark-share-actions">
              <span>{storyText.length}/1200</span>
              <button className="spark-primary-button" type="submit" disabled={shareBusy}>
                {shareBusy ? "Sharing..." : "Share testimony"}
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

                return (
                  <article className="spark-testimony-card" key={testimony.id}>
                    <div className="spark-card-meta">
                      <span>{personName(testimony.person)}</span>
                      <time dateTime={testimony.created_at}>{formatDate(testimony.created_at)}</time>
                    </div>
                    <p className="spark-story-text">{testimony.content}</p>
                    <div className="spark-encouragement-summary">
                      <strong>{encouragements.length}</strong> encouragement{encouragements.length === 1 ? "" : "s"}
                    </div>
                    {encouragements.some((item) => item.note) ? (
                      <ul className="spark-encouragement-notes" aria-label="Encouragement notes">
                        {encouragements
                          .filter((item) => item.note)
                          .slice(0, 3)
                          .map((item) => (
                            <li key={item.id}>
                              <span>{personName(item.person)}</span>
                              {item.note}
                            </li>
                          ))}
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
                        disabled={encouragingId === testimony.id}
                        aria-label={`Encourage testimony from ${personName(testimony.person)}`}
                      >
                        {encouragingId === testimony.id ? "Encouraging..." : alreadyEncouraged ? "Encouraged" : "Encourage"}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <article className="spark-empty-state">
                <h2>No stories yet.</h2>
                <p>Your testimony can be the first small light someone finds here.</p>
              </article>
            )}
          </div>
        </section>
      ) : null}

      <span data-testid="spark-approved-preview" hidden />
      <span data-testid="spark-review-queue-lite" hidden />
      <span data-testid="spark-reminder-lite" hidden />
      <span data-testid="spark-public-trial-readiness" hidden />
    </main>
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
    <section className="spark-auth-panel" aria-labelledby="spark-auth-title">
      <div>
        <p className="spark-mvp-kicker">Sign in</p>
        <h2 id="spark-auth-title">{authMode === "sign-in" ? "Welcome back." : "Create your place here."}</h2>
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
    <section className="spark-auth-panel" role="status">
      <p className="spark-mvp-kicker">Setup needed</p>
      <h2>Connect the shared Supabase project.</h2>
      <p>Add the public Supabase URL and publishable key for the free DEV project before using this MVP.</p>
    </section>
  );
}

function getDisplayName(user: User) {
  const metadataName = typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim() : "";
  if (metadataName) return metadataName;
  return user.email?.split("@")[0] || "A hopeful friend";
}

function personName(relation: PersonNameRelation | undefined) {
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
