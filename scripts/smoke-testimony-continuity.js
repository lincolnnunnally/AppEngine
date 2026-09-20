import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const SPARK_HOPE_STORIES_URL = "https://spark.unitedundergod.org/hope-stories";
const SPARK_HOME_URL = "https://spark.unitedundergod.org/";
const LOM_TESTIMONIES_URL = "https://liveonmission.unitedundergod.org/testimonies";

const liveDoors = read("src/lib/spark-of-hope-intake-lite/live-doors.ts");
assertIncludes(liveDoors, SPARK_HOPE_STORIES_URL, "Hope Stories find door");
assertIncludes(liveDoors, SPARK_HOME_URL, "Spark being-heard write door");
assertIncludes(liveDoors, LOM_TESTIMONIES_URL, "LOM testimony share/read door");
assertIncludes(liveDoors, "https://spark-of-hope.com/hope-stories", "Hope Stories equivalent host");
assertIncludes(liveDoors, "https://live-on-mission.com/testimonies", "LOM equivalent host");
assertIncludes(liveDoors, 'id: "hope-stories-find"', "find door id");
assertIncludes(liveDoors, 'id: "being-heard-write"', "write door id");
assertIncludes(liveDoors, 'id: "lom-testimony-share"', "share door id");
assert(!liveDoors.includes("singtrue"), "HOLD invent SingTrue in live-doors");

const page = read("src/app/spark-of-hope-intake-lite/page.tsx");
assertIncludes(page, 'data-testid="spark-live-doors"', "intake-lite exposes live-doors Continuity");
assertIncludes(page, "SPARK_HOPE_STORIES_URL", "intake-lite links Hope Stories find door");
assertIncludes(page, "LOM_TESTIMONIES_URL", "intake-lite links LOM testimony share door");
assertIncludes(page, "This preview is not the public share door", "success next-step stays honest");
assertIncludes(page, "This local list is not the live find door", "approved empty state stays honest");
assert(!page.includes("singtrue"), "HOLD invent SingTrue");
assertIncludes(page, "not a TestimonyHub door", "intake-lite must not treat ChurchConnect as TestimonyHub");

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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
