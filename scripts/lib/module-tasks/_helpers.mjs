// Shared helpers for module task scenarios (not a task itself: no `task` export).

// JSON call as the page's signed-in user (shares its cookies). Throws on a
// non-2xx response or { ok: false }, with the server's message.
export async function api(page, method, url, body) {
  const res = await page.request.fetch(url, {
    method,
    data: body === undefined ? undefined : body,
    headers: body === undefined ? undefined : { "content-type": "application/json" }
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!res.ok() || (json && json.ok === false)) {
    throw new Error(`${method} ${new URL(url).pathname} → ${res.status()} ${json?.message || text.slice(0, 200)}`);
  }
  return json ?? {};
}

// Open a page and require some text on it (what a person would actually see).
export async function expectText(page, url, text, what) {
  const res = await page.goto(url, { waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText();
  if (!res || res.status() >= 400 || !body.includes(text)) {
    throw new Error(`${what}: "${text}" not on ${new URL(url).pathname} (status ${res?.status()})`);
  }
}
