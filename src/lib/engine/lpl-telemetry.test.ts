// The shared tracker (shared-client/lpl-telemetry/telemetry.ts) that every app copies byte for byte.
// Owner, 2026-11-24: guide clicks and the customers they bring must be credited to the right guide,
// and tracking must never stop a sign-up or payment screen.
import { test } from "node:test";
import assert from "node:assert/strict";

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
const mem = (): Store => {
  const m = new Map<string, string>();
  return { getItem: (k) => (m.has(k) ? m.get(k)! : null), setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

test("tagged links, visit boundaries and blocked storage", async () => {
  const sent: Array<{ session_id: string; utm: Record<string, string> }> = [];
  let search = "";
  let throwing = false;
  const ls = mem();
  const ss = mem();
  const win: Record<string, unknown> = { location: { get search() { return search; }, pathname: "/guides/x" }, navigator: {}, addEventListener() {} };
  Object.defineProperty(win, "localStorage", { get() { if (throwing) throw new Error("SecurityError"); return ls; } });
  Object.defineProperty(win, "sessionStorage", { get() { if (throwing) throw new Error("SecurityError"); return ss; } });
  Object.assign(globalThis, { window: win, document: { referrer: "", addEventListener() {}, visibilityState: "visible" } });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { sendBeacon: (_u: string, b: Blob) => { void b.text().then((t) => sent.push(...JSON.parse(t).events)); return true; } }
  });
  const T = await import("../../../shared-client/lpl-telemetry/telemetry.ts");
  const settle = async () => { T.flushTelemetry(); await new Promise((r) => setTimeout(r, 20)); };

  T.initTelemetry({ app: "test", respectDoNotTrack: false });
  search = "?utm_source=facebook&utm_campaign=post1";
  T.track("page_view");
  search = "?utm_source=guide&utm_campaign=lost-cat";
  T.track("page_view");
  search = "";
  T.track("signup_completed");
  await settle();
  assert.equal(sent[0].utm.utm_source, "facebook");
  assert.equal(sent[1].utm.utm_campaign, "lost-cat", "the guide's tagged link wins over an earlier tag");
  assert.equal(sent[2].utm.utm_campaign, "lost-cat", "a later sign-up in the same visit carries the guide");

  ss.setItem("lpl_sess_ts", String(Date.now() - 31 * 60 * 1000));
  T.track("page_view");
  await settle();
  assert.deepEqual(sent[3].utm, {}, "a new visit does not inherit the old campaign");
  assert.notEqual(sent[3].session_id, sent[2].session_id);

  throwing = true;
  assert.doesNotThrow(() => {
    T.track("signup_completed");
    T.funnel.paymentCompleted({});
    T.trackPageView();
  }, "blocked storage never throws into a sign-up or payment handler");
});
