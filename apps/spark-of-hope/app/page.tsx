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
  person_id?: string;
  note: string | null;
  is_approved: boolean;
  created_at: string;
  person?: PersonNameRelation;
};

type Testimony = {
  id: string;
  person_id?: string;
  content: string;
  kind: string;
  visibility: string;
  needs_categories: string[] | null;
  is_approved: boolean;
  is_anonymous: boolean;
  created_at: string;
  person?: PersonNameRelation;
  testimony_encouragement?: Encouragement[];
};

type PersonNameRelation = { display_name: string | null } | { display_name: string | null }[] | null;

type AuthMode = "sign-in" | "sign-up";
type FeelingId =
  | "lonely"
  | "grieving"
  | "anxious"
  | "weary"
  | "overwhelmed"
  | "sick"
  | "money_stress"
  | "family_conflict"
  | "church_hurt"
  | "needing_purpose"
  | "something_else";
type StoryCategory = FeelingId | "hope";

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
  content,
  kind,
  visibility,
  needs_categories,
  is_approved,
  is_anonymous,
  created_at,
  testimony_encouragement(
    id,
    testimony_id,
    note,
    is_approved,
    created_at
  )
`;

const signedInTestimonySelect = `
  id,
  content,
  kind,
  visibility,
  needs_categories,
  is_approved,
  is_anonymous,
  created_at,
  testimony_encouragement(
    id,
    testimony_id,
    person_id,
    note,
    is_approved,
    created_at
  )
`;

type CompassionReflection = {
  title: string;
  body: string;
  hope: string;
  nextStep: string;
  action: "read" | "share" | "ask" | "save" | "small_step";
};

const feelingOptions: Array<{ id: FeelingId; label: string; helper: string }> = [
  { id: "lonely", label: "Lonely", helper: "When it feels like no one sees you." },
  { id: "grieving", label: "Grieving", helper: "When loss is heavy." },
  { id: "anxious", label: "Anxious", helper: "When your mind will not quiet down." },
  { id: "weary", label: "Weary", helper: "When you are tired from carrying it." },
  { id: "overwhelmed", label: "Overwhelmed", helper: "When it is all too much." },
  { id: "sick", label: "Sick", helper: "When your body or health feels fragile." },
  { id: "money_stress", label: "Money stress", helper: "When bills, work, or provision feel heavy." },
  { id: "family_conflict", label: "Family conflict", helper: "When home or close relationships hurt." },
  { id: "church_hurt", label: "Church hurt", helper: "When faith still matters, but people have wounded you." },
  { id: "needing_purpose", label: "Needing purpose", helper: "When you need meaning for the next step." },
  { id: "something_else", label: "Something else", helper: "When the words do not fit one category." }
];

const categoryLabels: Record<StoryCategory, string> = {
  lonely: "Lonely",
  grieving: "Grieving",
  anxious: "Anxious",
  weary: "Weary",
  overwhelmed: "Overwhelmed",
  sick: "Sick",
  money_stress: "Money stress",
  family_conflict: "Family conflict",
  church_hurt: "Church hurt",
  needing_purpose: "Needing purpose",
  something_else: "Something else",
  hope: "Hope"
};

const compassionReflections: Record<FeelingId, CompassionReflection> = {
  lonely: {
    title: "You do not have to disappear here.",
    body:
      "Loneliness can make the room feel louder and the heart feel unseen. You are not alone in this. Others have carried that ache, and God has met them through a message, a meal, a remembered name, or one person who stayed.",
    hope: "Start with one story from someone who felt unseen and found a small sign of care.",
    nextStep: "Read one matched story and let one sentence stay with you.",
    action: "read"
  },
  grieving: {
    title: "Grief deserves gentleness.",
    body:
      "Loss can make ordinary days feel unfamiliar. We will not rush you or explain your pain away. People here have walked through sorrow and still found small mercies, honest prayers, and enough light for one more day.",
    hope: "You can move slowly. One story may be enough for now.",
    nextStep: "Read one story, then take one slow breath before you do anything else.",
    action: "small_step"
  },
  anxious: {
    title: "You are not a burden for feeling afraid.",
    body:
      "Anxiety can make everything feel urgent at once. You are not alone, and you do not have to solve everything before you can receive care. Others have been met by God in the middle of racing thoughts and found a next breath.",
    hope: "Look for one story where peace came in a small, practical way.",
    nextStep: "Read one story and name one thing that is true right now.",
    action: "read"
  },
  weary: {
    title: "Being tired does not mean you are failing.",
    body:
      "Weariness often comes after a long season of trying to be strong. We are glad you came with what little energy you had. People have walked through that heaviness and found God meeting them through rest, help, and quiet kindness.",
    hope: "Let a story carry some hope for you for a minute.",
    nextStep: "Save one sentence that feels like a small light.",
    action: "save"
  },
  overwhelmed: {
    title: "You can take this one step at a time.",
    body:
      "When everything is too much, even hope can feel like one more thing to carry. You do not have to carry the whole future here. Others have come with tangled days and found one next step, one prayer, one person, one spark.",
    hope: "Start small. A matched story is enough.",
    nextStep: "Choose one small step today, even if it is only asking for help.",
    action: "small_step"
  },
  sick: {
    title: "Your body and your fear both matter.",
    body:
      "Sickness can be lonely, frustrating, and scary. You are not weak for needing comfort. People have walked through pain, waiting rooms, diagnoses, and uncertain days while still finding God near in quiet ways.",
    hope: "Find one story that reminds you care can reach you even here.",
    nextStep: "Ask someone safe for encouragement today.",
    action: "ask"
  },
  money_stress: {
    title: "Provision fears can feel deeply personal.",
    body:
      "Money stress can press on your sleep, your dignity, and your sense of safety. We will not minimize that. Others have faced empty numbers and hard choices and still found help, generosity, and reminders that God sees practical needs.",
    hope: "Read a story where help came through a small act of provision.",
    nextStep: "Read one story before you make the next practical decision.",
    action: "read"
  },
  family_conflict: {
    title: "Home pain is real pain.",
    body:
      "Family conflict can leave you feeling exposed in the place you most wanted peace. You are not alone, and you do not have to pretend it is fine. Others have walked through hard conversations, distance, repair, and waiting with hope.",
    hope: "Let one story remind you that tenderness can still grow in hard places.",
    nextStep: "Take one small step toward peace that does not require fixing everything today.",
    action: "small_step"
  },
  church_hurt: {
    title: "You can be honest about the wound.",
    body:
      "Being hurt by people connected to faith can be confusing and heavy. We will not rush you back into easy words. You are not alone; others have carried disappointment, questions, and pain while still finding God gentle and near.",
    hope: "Read a gentle story without forcing yourself to explain everything yet.",
    nextStep: "Save one line that helps you separate God from the harm done to you.",
    action: "save"
  },
  needing_purpose: {
    title: "Your life still carries meaning.",
    body:
      "When purpose feels dim, it can seem like everyone else received a map and you did not. You are not behind beyond hope. Others have found purpose returning through service, healing, prayer, and one faithful step at a time.",
    hope: "Look for a story where meaning came back in a small beginning.",
    nextStep: "Choose one small thing today that gives life instead of drains it.",
    action: "small_step"
  },
  something_else: {
    title: "You do not need perfect words to be welcomed.",
    body:
      "Some days do not fit a neat label. That is okay. You are here, and that matters. People have come with complicated stories and still found kindness, prayer, courage, and a spark of hope they did not expect.",
    hope: "Browse gently until one story feels close enough.",
    nextStep: "Read one story, or share your own when you are ready.",
    action: "read"
  }
};

const actionLabels: Record<CompassionReflection["action"], string> = {
  read: "Read a matched story",
  share: "Share your own",
  ask: "Ask for encouragement",
  save: "Save this spark",
  small_step: "One small step today"
};

const feelingLabels = new Map(Object.entries(categoryLabels));

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
  const [intakeText, setIntakeText] = useState("");
  const [doorwayTouched, setDoorwayTouched] = useState(false);
  const [safetyTriage, setSafetyTriage] = useState(false);
  const [storyText, setStoryText] = useState("");
  const [storyConsent, setStoryConsent] = useState(false);
  const [selectedFeeling, setSelectedFeeling] = useState<FeelingId | null>(null);
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
        void loadTestimonies(activeClient, selectedFeeling, false);
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

  useEffect(() => {
    if (!supabase || loading) return;
    void loadTestimonies(supabase, selectedFeeling, Boolean(session?.user));
  }, [loading, selectedFeeling, session?.user, supabase]);

  async function connectPersonAndFeed(client: SupabaseClient, user: User, active = true) {
    setLoading(true);
    const linkedPerson = await ensurePerson(client, user);

    if (!active) return;

    if (!linkedPerson) {
      await loadTestimonies(client, selectedFeeling, false);
      setLoading(false);
      return;
    }

    setPerson(linkedPerson);
    await loadTestimonies(client, selectedFeeling, true);
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

  async function loadTestimonies(client = supabase, feeling = selectedFeeling, includeViewerFields = Boolean(session?.user)) {
    if (!client) return;

    let query = client
      .from("testimony")
      .select(includeViewerFields ? signedInTestimonySelect : testimonySelect)
      .eq("kind", "spark_of_hope_story")
      .eq("visibility", "public")
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(24);

    if (feeling) {
      query = query.contains("needs_categories", [feeling]);
    }

    const { data, error } = await query
      .returns<Testimony[]>();

    if (error) {
      setNotice({ tone: "error", message: "Stories could not be opened yet. Please pause and try again in a moment." });
      setTestimonies([]);
      return;
    }

    setTestimonies(data || []);
  }

  function showSafetyTriage(text?: string) {
    setSafetyTriage(true);
    setDoorwayTouched(true);
    setSelectedFeeling(null);
    setNotice(null);

    if (text) {
      setIntakeText(text);
    }

    window.setTimeout(() => {
      document.getElementById("spark-support-now")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function selectFeeling(feeling: FeelingId) {
    setSelectedFeeling(feeling);
    setDoorwayTouched(true);
    setSafetyTriage(false);
    setNotice(null);
  }

  function browseAllStories() {
    setSelectedFeeling(null);
    setDoorwayTouched(true);
    setSafetyTriage(false);
    setNotice(null);
  }

  function handleDoorwaySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = intakeText.trim();

    if (!content) {
      setNotice({ tone: "care", message: "If words are hard, choose one of the feelings or browse all stories." });
      return;
    }

    if (hasAcuteCrisisSignal(content)) {
      showSafetyTriage(content);
      return;
    }

    selectFeeling(inferFeelingFromText(content));
  }

  function saveDoorwaySpark() {
    if (!selectedFeeling) return;

    const reflection = compassionReflections[selectedFeeling];
    window.localStorage.setItem(
      "spark-of-hope.saved-doorway-v1",
      JSON.stringify({
        feeling: selectedFeeling,
        intake: intakeText.trim(),
        title: reflection.title,
        hope: reflection.hope,
        savedAt: new Date().toISOString()
      })
    );
    setNotice({ tone: "good", message: "Saved here on this device. Come back to this small spark when you need it." });
  }

  function markSmallStep() {
    setNotice({ tone: "care", message: "One small step is enough for today. You do not have to carry everything at once." });
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
    if (hasAcuteCrisisSignal(content)) {
      showSafetyTriage(content);
      return;
    }

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
      needs_categories: selectedFeeling ? [selectedFeeling] : ["hope"],
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
    await loadTestimonies(undefined, selectedFeeling, true);
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
    await loadTestimonies(undefined, selectedFeeling, true);
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

      <section className="spark-mvp-hero" id="hope" aria-labelledby="spark-title">
        <p className="spark-mvp-kicker">Stories of hope</p>
        <h1 id="spark-title">There is still light here.</h1>
        <p>Start with one honest story from someone who found a spark in the dark.</p>
      </section>

      {notice ? (
        <p className={`spark-mvp-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"} aria-live="polite">
          {notice.message}
        </p>
      ) : null}

      {!configured ? <SetupPanel /> : null}
      {configured && loading ? <LoadingPanel /> : null}
      {configured && !loading ? (
        <>
          <IntakeDoorway
            intakeText={intakeText}
            selectedFeeling={selectedFeeling}
            doorwayTouched={doorwayTouched}
            onTextChange={setIntakeText}
            onSubmit={handleDoorwaySubmit}
            onSelect={selectFeeling}
            onBrowseAll={browseAllStories}
          />

          {safetyTriage ? (
            <SafetyTriagePanel onReset={browseAllStories} />
          ) : (
            <>
              {selectedFeeling ? (
                <CompassionReflectionCard
                  feeling={selectedFeeling}
                  signedIn={signedIn}
                  onSave={saveDoorwaySpark}
                  onSmallStep={markSmallStep}
                />
              ) : null}

              <section className="spark-story-stage" aria-label="Spark of hope stories">
                <div className="spark-feed-heading">
                  <div>
                    <p className="spark-mvp-kicker">Testimonies</p>
                    <h2 id="spark-feed-title">
                      {selectedFeeling ? "Stories from people who have walked this" : "A gentle mix of hope"}
                    </h2>
                    <p>
                      {selectedFeeling
                        ? `${feelingLabels.get(selectedFeeling)} stories, matched by what people carried and where hope met them.`
                        : "A few real sparks for whatever you brought with you today."}
                    </p>
                  </div>
                  <button className="spark-quiet-button" type="button" onClick={() => loadTestimonies(undefined, selectedFeeling, signedIn)}>
                    Refresh
                  </button>
                </div>

                <div className="spark-testimony-feed" aria-live="polite">
                  {testimonies.length ? (
                    testimonies.map((testimony) => {
                      const encouragements = testimony.testimony_encouragement || [];
                      const alreadyEncouraged = activePerson
                        ? encouragements.some((encouragement) => encouragement.person_id === activePerson.id)
                        : false;
                      const storyReportKey = `story:${testimony.id}`;
                      const authorName = personName(testimony.person, testimony.is_anonymous);
                      const themeLabels = storyThemeLabels(testimony.needs_categories);

                      return (
                        <article className="spark-testimony-card" key={testimony.id}>
                          <div className="spark-card-meta">
                            <span>{authorName}</span>
                            <time dateTime={testimony.created_at}>{formatDate(testimony.created_at)}</time>
                          </div>
                          {themeLabels.length ? (
                            <ul className="spark-story-tags" aria-label="Story themes">
                              {themeLabels.map((label) => (
                                <li key={label}>{label}</li>
                              ))}
                            </ul>
                          ) : null}
                          <p className="spark-story-text">{testimony.content}</p>
                          <div className="spark-story-footer">
                            <div className="spark-encouragement-summary" aria-label={`${encouragements.length} found hope here`}>
                              <HeartIcon aria-hidden="true" />
                              <strong>{encouragements.length}</strong> found hope here
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
                          {activePerson ? (
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
                          ) : (
                            <a className="spark-story-login-link" href="#you">
                              Sign in quietly to encourage or share your spark
                            </a>
                          )}
                        </article>
                      );
                    })
                  ) : (
                    <article className="spark-empty-state">
                      <h2>{selectedFeeling ? "No story is tagged here yet" : "Be the first to share a spark"}</h2>
                      <p>
                        {selectedFeeling
                          ? "Try browsing all stories, or come back soon as more hope is gathered."
                          : "Your story can be the first small light someone finds here."}
                      </p>
                      {selectedFeeling ? (
                        <button className="spark-link-button" type="button" onClick={browseAllStories}>
                          Browse all stories
                        </button>
                      ) : null}
                    </article>
                  )}
                </div>
              </section>
            </>
          )}

          {activePerson ? (
            <section className="spark-mvp-loop" aria-label="Share and account">
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
          ) : (
            <AuthPanel authMode={authMode} authBusy={authBusy} onAuthModeChange={setAuthMode} onSubmit={handleAuth} />
          )}
        </>
      ) : null}

      <SupportFooter />
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

function IntakeDoorway({
  intakeText,
  selectedFeeling,
  doorwayTouched,
  onTextChange,
  onSubmit,
  onSelect,
  onBrowseAll
}: {
  intakeText: string;
  selectedFeeling: FeelingId | null;
  doorwayTouched: boolean;
  onTextChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSelect: (feeling: FeelingId) => void;
  onBrowseAll: () => void;
}) {
  return (
    <section className="spark-doorway-card" aria-labelledby="spark-doorway-title">
      <div>
        <p className="spark-mvp-kicker">Start where you are</p>
        <h2 id="spark-doorway-title">We are here for you. What is going on today?</h2>
        <p>A sentence is enough, or choose what feels closest. You can also skip this and browse every story.</p>
      </div>
      <form className="spark-doorway-form" onSubmit={onSubmit}>
        <label htmlFor="spark-today">What are you carrying right now?</label>
        <textarea
          id="spark-today"
          value={intakeText}
          onChange={(event) => onTextChange(event.target.value)}
          maxLength={500}
          placeholder="I am feeling alone tonight, and I just need something hopeful."
        />
        <div className="spark-doorway-actions">
          <span>{intakeText.length}/500</span>
          <button className="spark-primary-button" type="submit">
            Find stories that understand
          </button>
        </div>
      </form>
      <div className="spark-chip-fieldset" aria-label="Choose a feeling to find matching stories">
        <p className="spark-chip-legend">Or choose what feels closest</p>
        <div className="spark-feeling-chips" role="list">
          {feelingOptions.map((option) => (
            <button
              className={`spark-feeling-chip${selectedFeeling === option.id ? " selected" : ""}`}
              type="button"
              key={option.id}
              onClick={() => onSelect(option.id)}
              aria-pressed={selectedFeeling === option.id}
              title={option.helper}
            >
              {option.label}
            </button>
          ))}
          <button className="spark-feeling-chip browse" type="button" onClick={onBrowseAll} aria-pressed={doorwayTouched && !selectedFeeling}>
            Browse all stories
          </button>
        </div>
      </div>
    </section>
  );
}

function CompassionReflectionCard({
  feeling,
  signedIn,
  onSave,
  onSmallStep
}: {
  feeling: FeelingId;
  signedIn: boolean;
  onSave: () => void;
  onSmallStep: () => void;
}) {
  const reflection = compassionReflections[feeling];

  return (
    <section className="spark-reflection-card" aria-labelledby="spark-reflection-title">
      <div>
        <p className="spark-mvp-kicker">We hear you</p>
        <h2 id="spark-reflection-title">{reflection.title}</h2>
        <p className="spark-reflection-body">{reflection.body}</p>
      </div>
      <div className="spark-hope-step">
        <p>{reflection.hope}</p>
        <div>
          <span>One gentle next step</span>
          <strong>{reflection.nextStep}</strong>
        </div>
        <HopeAction action={reflection.action} signedIn={signedIn} onSave={onSave} onSmallStep={onSmallStep} />
      </div>
    </section>
  );
}

function HopeAction({
  action,
  signedIn,
  onSave,
  onSmallStep
}: {
  action: CompassionReflection["action"];
  signedIn: boolean;
  onSave: () => void;
  onSmallStep: () => void;
}) {
  if (action === "save") {
    return (
      <button className="spark-secondary-button spark-next-action" type="button" onClick={onSave}>
        {actionLabels.save}
      </button>
    );
  }

  if (action === "small_step") {
    return (
      <button className="spark-secondary-button spark-next-action" type="button" onClick={onSmallStep}>
        {actionLabels.small_step}
      </button>
    );
  }

  if (action === "share") {
    return (
      <a className="spark-secondary-button spark-next-action" href="#share">
        {actionLabels.share}
      </a>
    );
  }

  if (action === "ask") {
    return (
      <a className="spark-secondary-button spark-next-action" href={signedIn ? "#share" : "#you"}>
        {actionLabels.ask}
      </a>
    );
  }

  return (
    <a className="spark-secondary-button spark-next-action" href="#spark-feed-title">
      {actionLabels.read}
    </a>
  );
}

function SafetyTriagePanel({ onReset }: { onReset: () => void }) {
  return (
    <section className="spark-crisis-panel" id="spark-support-now" role="alert" aria-labelledby="spark-support-now-title">
      <p className="spark-mvp-kicker">Immediate support</p>
      <h2 id="spark-support-now-title">Thank you for telling us. You deserve help right now.</h2>
      <p>
        This space is not monitored for urgent help. Please call or text 988 now, or ask a trusted person near you to stay
        with you while you reach out. After you are safe, Spark will still be here.
      </p>
      <div className="spark-crisis-actions">
        <a className="spark-primary-button" href="https://988lifeline.org/" target="_blank" rel="noreferrer">
          Call or text 988
        </a>
        <button className="spark-link-button" type="button" onClick={onReset}>
          I am safe right now; show me all stories
        </button>
      </div>
    </section>
  );
}

function SupportFooter() {
  return (
    <p className="spark-support-line">
      This is peer encouragement, not crisis or professional care. Need urgent support?{" "}
      <a href="https://988lifeline.org/" target="_blank" rel="noreferrer">
        Call or text 988
      </a>
      . This space is not monitored for urgent help.
    </p>
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
        <p className="spark-mvp-kicker">When you are ready</p>
        <h2 id="spark-auth-title">{authMode === "sign-in" ? "Sign in quietly" : "Create your place here"}</h2>
        <p>Sign in only if you want to share a spark, encourage a story, or keep your place connected.</p>
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

function normalizeCareText(value: string) {
  return value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAcuteCrisisSignal(value: string) {
  const normalized = normalizeCareText(value);

  if (!normalized) return false;

  return [
    /\b(suicide|suicidal|kill myself|end my life|take my life|want to die|wish i was dead|end it all)\b/,
    /\b(hurt myself|harm myself|self harm|self-harm|cut myself|overdose|no reason to live)\b/,
    /\b(can't go on|cannot go on|dont want to live|don't want to live)\b/,
    /\b(kill|hurt|harm)\s+(someone|somebody|them|him|her|people)\b/
  ].some((pattern) => pattern.test(normalized));
}

function inferFeelingFromText(value: string): FeelingId {
  const normalized = normalizeCareText(value);
  const keywordGroups: Array<[FeelingId, RegExp[]]> = [
    ["church_hurt", [/\bchurch hurt\b/, /\bpastor\b/, /\bministry\b/, /\bspiritual abuse\b/, /\bhypocrisy\b/]],
    ["money_stress", [/\bmoney\b/, /\bbills?\b/, /\brent\b/, /\bgrocer(y|ies)\b/, /\bdebt\b/, /\bjob\b/, /\bunemployed\b/]],
    ["family_conflict", [/\bfamily\b/, /\bmarriage\b/, /\bspouse\b/, /\bparent\b/, /\bchild\b/, /\bdivorce\b/, /\bargument\b/]],
    ["sick", [/\bsick\b/, /\bill(ness)?\b/, /\bhospital\b/, /\bpain\b/, /\bdiagnos(is|ed)\b/, /\bdoctor\b/]],
    ["grieving", [/\bgrief\b/, /\bgrieving\b/, /\bdied\b/, /\bdeath\b/, /\bloss\b/, /\bfuneral\b/, /\bmiss them\b/]],
    ["anxious", [/\banxious\b/, /\banxiety\b/, /\bpanic\b/, /\bafraid\b/, /\bscared\b/, /\bworr(y|ied)\b/, /\bfear\b/]],
    ["overwhelmed", [/\boverwhelmed\b/, /\btoo much\b/, /\bdrowning\b/, /\bcan't handle\b/, /\bcannot handle\b/, /\bstressed\b/]],
    ["weary", [/\bweary\b/, /\btired\b/, /\bexhausted\b/, /\bworn out\b/, /\bburned out\b/, /\bburnt out\b/]],
    ["lonely", [/\blonely\b/, /\balone\b/, /\bisolated\b/, /\bunseen\b/, /\bignored\b/, /\bno friends\b/]],
    ["needing_purpose", [/\bpurpose\b/, /\bmeaning\b/, /\bdirection\b/, /\buseless\b/, /\bstuck\b/, /\bwhy am i here\b/]]
  ];

  return keywordGroups.find(([, patterns]) => patterns.some((pattern) => pattern.test(normalized)))?.[0] || "something_else";
}

function storyThemeLabels(categories: string[] | null | undefined) {
  return (categories || [])
    .map((category) => feelingLabels.get(category as StoryCategory))
    .filter((label): label is string => Boolean(label))
    .slice(0, 3);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}
