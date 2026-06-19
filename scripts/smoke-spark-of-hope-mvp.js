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
assertIncludes(page, "Spark of hope", "Spark brand language");
assertIncludes(page, "Need urgent support? Call or text 988", "988 crisis link");
assertIncludes(page, "This is peer encouragement, not crisis or professional care.", "care boundary");
assertIncludes(page, "This space is not monitored for urgent help.", "urgent-care boundary");
assertIncludes(page, "Share your spark", "share CTA");
assertNotIncludes(page, ">App Engine<", "Spark user-facing page");

const styles = read("src/app/styles.css");
assertIncludes(styles, ".spark-mvp-page", "Spark MVP styles");
assertIncludes(styles, ".spark-story-text", "story serif styles");
assertIncludes(styles, ".spark-bottom-nav", "bottom navigation styles");

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

console.log("spark-of-hope-mvp smoke ok");
