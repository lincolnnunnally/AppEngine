// EXIST live testimony doors — Continuity only.
// AppEngine spark-of-hope-intake-lite is a private preview, not the public
// share/find wall. These URLs were verified 2026-09-20.
// HOLD invent: no mega-hub, no ChurchConnect TestimonyHub door, no SingTrue.
// Do not deploy from spark-of-hope-vercel-recovery.

export const SPARK_HOME_URL = "https://spark.unitedundergod.org/";
export const SPARK_HOPE_STORIES_URL = "https://spark.unitedundergod.org/hope-stories";
export const LOM_TESTIMONIES_URL = "https://liveonmission.unitedundergod.org/testimonies";

// Same apps on their own domains — equivalent hosts, not extra products.
export const SPARK_HOPE_STORIES_EQUIVALENT_URL = "https://spark-of-hope.com/hope-stories";
export const LOM_TESTIMONIES_EQUIVALENT_URL = "https://live-on-mission.com/testimonies";

export type SparkLiveDoor = {
  id: "being-heard-write" | "hope-stories-find" | "lom-testimony-share";
  label: string;
  href: string;
  note: string;
};

export const sparkLiveDoors: readonly SparkLiveDoor[] = [
  {
    id: "hope-stories-find",
    label: "Read Hope Stories",
    href: SPARK_HOPE_STORIES_URL,
    note: "Spark of Hope find door. Curated starter stories — not a live approved testimony feed."
  },
  {
    id: "being-heard-write",
    label: "Be heard on Spark",
    href: SPARK_HOME_URL,
    note: "Write without an account. Session-local. Not the reviewed testimony share door."
  },
  {
    id: "lom-testimony-share",
    label: "Share a testimony",
    href: LOM_TESTIMONIES_URL,
    note: "Live On Mission /testimonies — factory testimony-engine share and read. Sign-in required to share."
  }
];
