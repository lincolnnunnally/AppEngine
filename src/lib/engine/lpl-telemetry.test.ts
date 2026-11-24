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
  let pathname = "/guides/x";
  let referrer = "";
  let throwing = false;
  const ls = mem();
  const ss = mem();
  const win: Record<string, unknown> = { location: { get search() { return search; }, get pathname() { return pathname; } }, navigator: {}, addEventListener() {} };
  Object.defineProperty(win, "localStorage", { get() { if (throwing) throw new Error("SecurityError"); return ls; } });
  Object.defineProperty(win, "sessionStorage", { get() { if (throwing) throw new Error("SecurityError"); return ss; } });
  Object.assign(globalThis, { window: win, document: { get referrer() { return referrer; }, addEventListener() {}, visibilityState: "visible" } });
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

  // A site's own ref= (a report id) joins the visit's tags instead of wiping the guide's campaign.
  sent.length = 0;
  search = "?utm_source=guide&utm_campaign=city-website";
  T.track("page_view");
  search = "?ref=report-123";
  T.track("page_view");
  search = "";
  T.track("signup_completed");
  await settle();
  assert.equal(sent[1].utm.utm_campaign, "city-website", "a bare ref keeps the guide's campaign");
  assert.equal(sent[1].utm.ref, "report-123");
  assert.equal(sent[2].utm.utm_campaign, "city-website", "the sign-up after it is still the guide's");

  // Secrets in an address never reach analytics: tokens in the path, and anything past a referrer's site.
  sent.length = 0;
  pathname = "/invite/abcDEF123456789xyz";
  referrer = "https://example.org/reset-password?token=secret123&app=x";
  T.track("page_view");
  pathname = "/account/confirm/tok_987/next";
  referrer = "not a url";
  T.track("page_view");
  await settle();
  const recorded = sent as unknown as Array<{ path: string; referrer: string | null }>;
  assert.equal(recorded[0].path, "/invite/:token");
  assert.equal(recorded[0].referrer, "https://example.org");
  assert.equal(recorded[1].path, "/account/confirm/:token/next");
  assert.equal(recorded[1].referrer, null);
  assert.ok(!JSON.stringify(sent).includes("secret123") && !JSON.stringify(sent).includes("abcDEF123456789xyz"));
  pathname = "/guides/x";
  referrer = "";

  throwing = true;
  assert.doesNotThrow(() => {
    T.track("signup_completed");
    T.funnel.paymentCompleted({});
    T.trackPageView();
  }, "blocked storage never throws into a sign-up or payment handler");

  // With storage blocked, one page's events still belong to one visitor, one visit and one campaign.
  sent.length = 0;
  search = "?utm_source=guide&utm_campaign=lost-dog";
  T.track("page_view");
  search = "";
  T.track("signup_completed");
  await settle();
  const view = sent.find((e) => (e as { name?: string }).name === "page_view" && e.utm.utm_campaign === "lost-dog")!;
  const signup = sent[sent.length - 1] as typeof view & { anon_id: string };
  assert.ok(view, "the guide view was sent");
  assert.equal(signup.session_id, view.session_id, "same visit with storage blocked");
  assert.equal(signup.anon_id, (view as typeof signup).anon_id, "same visitor with storage blocked");
  assert.equal(signup.utm.utm_campaign, "lost-dog", "the sign-up keeps the guide's campaign with storage blocked");
});
