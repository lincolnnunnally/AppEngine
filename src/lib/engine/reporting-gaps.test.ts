import assert from "node:assert/strict";
import test from "node:test";
import { liveAppsNotReporting } from "./reporting-gaps.ts";

test("only live apps with no number are listed, by name", () => {
  const missing = liveAppsNotReporting([
    { slug: "spark-of-hope", name: "Spark of Hope", status: "live", reporting: true },
    { slug: "pulse", name: "Pulse", status: "live", reporting: false },
    { slug: "parked", name: "Parked", status: "awaiting_url", reporting: false },
    { slug: "honestly", name: "Honestly", status: "live", reporting: false }
  ]);
  assert.deepEqual(missing, [
    { slug: "honestly", name: "Honestly" },
    { slug: "pulse", name: "Pulse" }
  ]);
});
