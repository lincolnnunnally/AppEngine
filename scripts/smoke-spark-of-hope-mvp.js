import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assertIncludes(contents, expected, label) {
  if (!contents.includes(expected)) {
    throw new Error(`${label} missing ${expected}`);
  }
}

function assertNotIncludes(contents, unexpected, label) {
  if (contents.includes(unexpected)) {
    throw new Error(`${label} should not include ${unexpected}`);
  }
}

const page = read("src/app/spark-of-hope/page.tsx");
const supabaseBrowser = read("src/lib/spark-of-hope/supabase-browser.ts");
assertIncludes(page, 'data-app-marker="spark-of-hope-mvp-v0-1"', "Spark MVP page marker");
assertIncludes(page, "createSparkSupabaseClient", "Supabase client");
assertIncludes(page, '.from("person")', "shared person identity");
assertIncludes(page, '.from("testimony")', "testimony feed/share");
assertIncludes(page, '.from("testimony_encouragement")', "encouragement persistence");
assertIncludes(page, '.from("testimony_report")', "report persistence");
assertIncludes(page, '.eq("kind", "spark_of_hope_story")', "Spark-scoped feed");
assertIncludes(page, '.eq("is_approved", true)', "approved-only feed");
assertIncludes(page, 'visibility: "private"', "private story submissions");
assertIncludes(page, 'is_anonymous: true', "anonymous story submissions");
assertIncludes(page, '.from("person_consent")', "story consent persistence");
assertIncludes(page, "Encourage", "encourage language");
assertIncludes(page, "found hope here", "hope count language");
assertIncludes(page, "We are here for you. What is going on today?", "welcome doorway");
assertIncludes(page, "What are you carrying right now?", "intake prompt");
assertIncludes(page, "Find stories that understand", "intake submit action");
assertIncludes(page, "Stories from people who have walked this", "matched testimony heading");
assertIncludes(page, "compassionReflections", "curated compassion reflections");
assertIncludes(page, "hasAcuteCrisisSignal", "local safety triage");
assertIncludes(page, "SafetyTriagePanel", "safety triage panel");
assertIncludes(page, ".contains(\"needs_categories\"", "theme-matched feed");
assertIncludes(page, "money_stress", "money stress theme");
assertIncludes(page, "family_conflict", "family conflict theme");
assertIncludes(page, "church_hurt", "church hurt theme");
assertIncludes(page, "needing_purpose", "needing purpose theme");
assertIncludes(page, "Spark of hope", "Spark brand language");
assertIncludes(page, "Need urgent support?", "988 support prompt");
assertIncludes(page, "Call or text 988", "988 support link");
assertIncludes(page, "This is peer encouragement, not crisis or professional care.", "care boundary");
assertIncludes(page, "This space is not monitored for urgent help.", "urgent-care boundary");
assertIncludes(page, "Share your spark", "share CTA");
assertNotIncludes(page, "live AI", "Spark doorway");
assertNotIncludes(page, ">App Engine<", "Spark user-facing page");

const styles = read("src/app/styles.css");
assertIncludes(styles, ".spark-mvp-page", "Spark MVP styles");
assertIncludes(styles, ".spark-doorway-card", "doorway styles");
assertIncludes(styles, ".spark-reflection-card", "reflection styles");
assertIncludes(styles, ".spark-crisis-panel", "safety triage styles");
assertIncludes(styles, ".spark-story-text", "story serif styles");
assertIncludes(styles, ".spark-bottom-nav", "bottom navigation styles");
assertIncludes(supabaseBrowser, "sparkSupabaseClient", "Supabase browser singleton");

const migration = read("db/shared-supabase/001_spark_of_hope_mvp.sql");
assertIncludes(migration, "public.testimony_encouragement", "encouragement migration");
assertIncludes(migration, "enable row level security", "RLS");
assertIncludes(migration, "private.current_person_id()", "shared person RLS");

const reportMigration = read("db/shared-supabase/002_spark_of_hope_reports.sql");
assertIncludes(reportMigration, "public.testimony_report", "report migration");
assertIncludes(reportMigration, "enable row level security", "report RLS");
assertIncludes(reportMigration, "testimony_report_insert_own_visible_target", "report insert policy");

const reviewGateMigration = read("db/shared-supabase/004_spark_of_hope_review_gate.sql");
assertIncludes(reviewGateMigration, "is_approved", "testimony approval gate");
assertIncludes(reviewGateMigration, "is_anonymous", "testimony anonymity gate");
assertIncludes(reviewGateMigration, "grant update (note)", "encouragement note-only updates");
assertIncludes(reviewGateMigration, "note is null or is_approved", "public encouragement note gate");

const themeFeedMigration = read("db/shared-supabase/005_spark_of_hope_public_theme_feed.sql");
assertIncludes(themeFeedMigration, "needs_categories", "testimony theme tags");
assertIncludes(themeFeedMigration, "testimony_read_public_approved_spark", "public approved story policy");
assertIncludes(themeFeedMigration, "testimony_encouragement_read_public_approved_spark", "public approved encouragement policy");

console.log("spark-of-hope-mvp smoke ok");
