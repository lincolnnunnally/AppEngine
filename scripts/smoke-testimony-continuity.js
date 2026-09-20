import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

const liveDoors = await import(pathToFileURL(path.join(root, "src/lib/spark-of-hope-intake-lite/live-doors.ts")).href);
const {
  LOM_TESTIMONIES_EQUIVALENT_URL,
  LOM_TESTIMONIES_URL,
  SPARK_HOME_URL,
  SPARK_HOPE_STORIES_EQUIVALENT_URL,
  SPARK_HOPE_STORIES_URL,
  sparkLiveDoors
} = liveDoors;

assertEqual(SPARK_HOPE_STORIES_URL, "https://spark.unitedundergod.org/hope-stories", "Hope Stories find door");
assertEqual(SPARK_HOME_URL, "https://spark.unitedundergod.org/", "Spark being-heard write door");
assertEqual(LOM_TESTIMONIES_URL, "https://liveonmission.unitedundergod.org/testimonies", "LOM testimony share/read door");
assertEqual(SPARK_HOPE_STORIES_EQUIVALENT_URL, "https://spark-of-hope.com/hope-stories", "Hope Stories equivalent host");
assertEqual(LOM_TESTIMONIES_EQUIVALENT_URL, "https://live-on-mission.com/testimonies", "LOM equivalent host");
assert(sparkLiveDoors.length === 3, "exactly three EXIST live doors — no mega-hub");
assert(
  sparkLiveDoors.every((door) => door.href.startsWith("https://")),
  "live doors must be absolute EXIST urls"
);

const page = read("src/app/spark-of-hope-intake-lite/page.tsx");
assertIncludes(page, 'data-testid="spark-live-doors"', "intake-lite exposes live-doors Continuity");
assertIncludes(page, SPARK_HOPE_STORIES_URL, "intake-lite links Hope Stories find door");
assertIncludes(page, LOM_TESTIMONIES_URL, "intake-lite links LOM testimony share door");
assertIncludes(page, "This preview is not the public share door", "success next-step stays honest");
assertIncludes(page, "This local list is not the live find door", "approved empty state stays honest");
assert(!page.includes("singtrue"), "HOLD invent SingTrue");
assert(!page.includes("TestimonyHub"), "do not invent a ChurchConnect TestimonyHub door in the preview UI");

const showcase = read("src/lib/showcase/apps-showcase.ts");
assertIncludes(showcase, "SPARK_HOPE_STORIES_URL", "showcase Spark card uses Hope Stories EXIST constant");
assertIncludes(showcase, "LOM_TESTIMONIES_URL", "showcase LOM card uses Testimonies EXIST constant");
assertIncludes(showcase, 'label: "Hope Stories"', "showcase names Hope Stories");
assertIncludes(showcase, 'label: "Testimonies"', "showcase names Testimonies");

const showcasePage = read("src/app/apps-showcase/page.tsx");
assertIncludes(showcasePage, "app.doorLinks", "showcase renders EXIST door links");
assertIncludes(showcasePage, "uug-doors", "showcase door-link row exists");

const moduleFile = read("src/lib/engine/modules/testimony-engine.ts");
assertIncludes(moduleFile, LOM_TESTIMONIES_URL, "factory brick documents live LOM composition");
assertIncludes(moduleFile, SPARK_HOPE_STORIES_URL, "factory brick documents Spark find door");
assertIncludes(moduleFile, "Do not bake sibling URLs into generated app files", "generated apps stay purpose-separate");

const catalog = read("src/lib/engine/module-catalog.ts");
assertIncludes(catalog, '"live-on-mission"', "catalog lists LOM as a testimony-engine user");
assertIncludes(catalog, "not TestimonyHub", "catalog does not claim a live ChurchConnect TestimonyHub");

const source = read("source-of-truth/testimony-continuity.md");
assertIncludes(source, SPARK_HOPE_STORIES_URL, "SoT maps Hope Stories");
assertIncludes(source, LOM_TESTIMONIES_URL, "SoT maps LOM testimonies");
assertIncludes(source, "spark-of-hope-vercel-recovery", "SoT holds recovery deploy");
assertIncludes(source, "What AppEngine owns", "SoT maps factory ownership");

const manifest = read("agents/manifest.yaml");
assertIncludes(manifest, "source-of-truth/testimony-continuity.md", "manifest lists testimony Continuity SoT");

const packageJson = read("package.json");
assertIncludes(packageJson, "smoke:testimony-continuity", "package exposes Continuity smoke");

console.log("testimony-continuity smoke ok");

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

function assertIncludes(value, phrase, label) {
  if (!String(value || "").includes(phrase)) {
    throw new Error(`${label}: expected to include ${JSON.stringify(phrase)}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
