// Public profiles: a member publishes their profile page, and a SIGNED-OUT
// visitor opens the shared link and sees it — with real share-preview meta —
// while handles stay unique and unpublishing really takes the page down.
import { api, expectText } from "./_helpers.mjs";

export async function task({ page, base, visitor, newMember }) {
  const handle = `prove-grace-${Date.now().toString(36)}`;
  const member = await newMember();
  await api(member, "POST", `${base}/api/public-profiles`, {
    handle,
    name: "Grace Prove",
    archetype: "The Builder",
    purpose: "Helping neighbors build something lasting.",
    sweetSpot: "Turning a messy idea into a plan people can follow.",
    coreValues: "Honesty, Courage",
    interests: ["Woodworking"]
  });

  // The member's own editor knows the profile is theirs.
  await expectText(member, `${base}/p/me`, "View my public page", "the member's editor finds their saved profile");

  // A signed-out visitor opens the shared page and sees the person.
  await expectText(visitor, `${base}/p/${handle}`, "Grace Prove", "a signed-out visitor opens the shared profile");
  const body = await visitor.locator("body").innerText();
  for (const text of ["Honesty", "Woodworking", "Helping neighbors build something lasting."]) {
    if (!body.includes(text)) throw new Error(`public profile page is missing "${text}"`);
  }
  const ogTitle = await visitor.locator('meta[property="og:title"]').getAttribute("content");
  if (ogTitle !== "Grace Prove — The Builder") throw new Error(`profile page og:title is ${JSON.stringify(ogTitle)}`);

  // The share link (what unfurls in a chat) carries the preview for bots.
  const og = await visitor.request.get(`${base}/api/public-profiles/${handle}/og`);
  const ogHtml = await og.text();
  if (og.status() !== 200 || !ogHtml.includes('property="og:title" content="Grace Prove — The Builder"') || !ogHtml.includes(`/p/${handle}`)) {
    throw new Error(`share preview page status ${og.status()} lacks the profile's og meta`);
  }
  const json = await visitor.request.get(`${base}/api/public-profiles/${handle}`);
  if (json.status() !== 200 || (await json.json()).name !== "Grace Prove") throw new Error(`public profile JSON → ${json.status()}`);

  // The owner finds it in the directory.
  await expectText(page, `${base}/p`, "Grace Prove", "the profile is listed in the directory");

  // Nobody else can take the handle.
  const other = await newMember();
  const clash = await other.request.post(`${base}/api/public-profiles`, { data: { handle, name: "Impostor" } });
  if (clash.status() !== 409) throw new Error(`a second member claiming the same handle got ${clash.status()}, expected 409`);

  // Unpublishing takes it down for the public.
  await api(member, "POST", `${base}/api/public-profiles`, { handle, name: "Grace Prove", published: false });
  const gone = await visitor.goto(`${base}/p/${handle}`);
  if (gone.status() !== 404) throw new Error(`unpublished profile still answers ${gone.status()} to a visitor`);
}
