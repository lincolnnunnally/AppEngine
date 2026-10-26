// What a customer types → the pack they're quoted. A customer pays for these
// pieces, so the recommendation must contain what the job obviously needs and
// must not pad the bill with pieces that don't serve it. Each case is a real
// way people describe their problem; `must` = feature ids the quote must
// include, `never` = ids it must not include. Add a case whenever a real
// customer's request gets the wrong pack.
const { estimateBuild } = await import("../src/lib/engine/pricing/estimate.ts");

const CASES = [
  { need: "I run a small church and need people to sign up for events and give online", must: ["scheduling", "payments", "directory"], never: ["cases", "orders"] },
  { need: "I'm a plumber and I lose track of customers who asked for quotes", must: ["crm"], never: ["needs-match", "domains", "cases"] },
  { need: "Our food pantry needs to track who picked up food each week and what's on the shelves", must: ["shelf"], never: ["growth", "cases"] },
  { need: "I coach a youth soccer league and need to manage teams, schedules and parents", must: ["scheduling", "directory"], never: ["cases", "needs-match"] },
  { need: "I tutor high school students and need to book sessions and take payment", must: ["scheduling", "payments"], never: ["needs-match", "cases"] },
  { need: "Our nonprofit needs volunteers to sign up for shifts", must: ["scheduling"], never: ["orders", "cases"] },
  { need: "I want to sell my handmade candles online", must: ["orders", "payments"], never: ["needs-match", "crm", "cases"] },
  { need: "I'm a single mom and need help keeping track of bills and appointments", must: [], never: ["needs-match", "domains", "crm", "orders"], maxCents: 4500 },
  { need: "Our neighborhood wants a way to share tools and help each other", must: ["needs-match"], never: ["orders", "cases", "crm"] },
  { need: "I run a landscaping business and need to schedule jobs and send invoices", must: ["crm", "scheduling"], never: ["cases", "needs-match"] },
  { need: "Our HOA needs to share announcements and collect dues", must: ["notify", "payments"], never: ["cases", "needs-match", "orders"] },
  { need: "I'm a counselor and need clients to book appointments and fill out intake forms", must: ["scheduling", "intake"], never: ["orders", "needs-match"] },
  { need: "I'm looking for a job and keep losing track of my applications", must: ["cases"], never: ["orders", "payments"] },
  { need: "Our ministry matches families in need with people who can bring meals", must: ["needs-match"], never: ["orders", "cases"] },
  { need: "I'm a sales rep and leads keep going cold", must: ["crm"], never: ["needs-match", "cases", "orders"] }
];

let failures = 0;
for (const c of CASES) {
  const estimate = estimateBuild({ needText: c.need });
  const picked = new Set(estimate.features.filter((f) => f.selected).map((f) => f.id));
  const missing = c.must.filter((id) => !picked.has(id));
  const padded = c.never.filter((id) => picked.has(id));
  const tooDear = c.maxCents && estimate.priceCents > c.maxCents;
  const ok = !missing.length && !padded.length && !tooDear;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "ok" : "not ok"} - ${estimate.priceLabel.padStart(4)} ${[...picked].join(", ") || "(core only)"}` +
      (missing.length ? ` | missing: ${missing.join(", ")}` : "") +
      (padded.length ? ` | shouldn't have: ${padded.join(", ")}` : "") +
      (tooDear ? ` | over $${c.maxCents / 100}` : "") +
      `\n       ← ${c.need}`
  );
}

if (failures) {
  console.error(`recommendations smoke failed (${failures}/${CASES.length})`);
  process.exit(1);
}
console.log(`recommendations smoke ok (${CASES.length} real requests)`);
