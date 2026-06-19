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

const page = read("src/app/spark-of-hope-intake-lite/page.tsx");
assertIncludes(page, 'data-app-marker="spark-of-hope-mvp-v0-1"', "Spark MVP page marker");
assertIncludes(page, "createSparkSupabaseClient", "Supabase client");
assertIncludes(page, '.from("person")', "shared person identity");
assertIncludes(page, '.from("testimony")', "testimony feed/share");
assertIncludes(page, '.from("testimony_encouragement")', "encouragement persistence");
assertIncludes(page, "Encourage", "encourage language");

const styles = read("src/app/styles.css");
assertIncludes(styles, ".spark-mvp-page", "Spark MVP styles");
assertIncludes(styles, ".spark-story-text", "story serif styles");

const migration = read("db/shared-supabase/001_spark_of_hope_mvp.sql");
assertIncludes(migration, "public.testimony_encouragement", "encouragement migration");
assertIncludes(migration, "enable row level security", "RLS");
assertIncludes(migration, "private.current_person_id()", "shared person RLS");

console.log("spark-of-hope-mvp smoke ok");
