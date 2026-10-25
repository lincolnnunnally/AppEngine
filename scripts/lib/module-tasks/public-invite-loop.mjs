// Invitations: a member gets their invite link, a brand-new person opens it
// signed out, signs up through it, and the inviter sees that their friend
// joined. The job is "a friend I invite can actually join, and I'm credited".
import { api, expectText } from "./_helpers.mjs";

export async function task({ page, base, newMember }) {
  const inviter = await newMember();
  const { invite } = await api(inviter, "GET", `${base}/api/invites`);
  const code = invite?.inviteCode;
  if (!code || code === "preview") throw new Error(`the member got no real invite code (got ${JSON.stringify(code)})`);
  if (!String(invite.shareUrl).includes(`/invited-by/${code}`)) throw new Error(`share URL ${invite.shareUrl} does not carry the code`);
  if (!invite.messages?.some((m) => String(m.body).includes(`/invited-by/${code}`))) throw new Error("the pre-written messages do not include the invite link");

  // A new person, in their own signed-out browser, opens the link.
  const ctx = await inviter.context().browser().newContext();
  try {
    const friend = await ctx.newPage();
    await expectText(friend, `${base}/invited-by/${code}`, "glad it did", "the invite landing works for a signed-out friend");
    const join = friend.locator(`a[href*="${code}"]`).filter({ hasText: "sent me" }).first();
    if (!(await join.count())) throw new Error("the landing page has no sign-up link carrying the invite");
    await join.click();
    await friend.waitForURL((url) => url.pathname.startsWith("/sign-in"), { timeout: 15000 });
    await friend.fill('input[name="email"]', `invited-friend-${Date.now()}@example.com`);
    await friend.fill('input[name="password"]', "prove-password-123");
    await Promise.all([
      friend.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 20000 }),
      friend.click('button[value="register"]')
    ]);
    const landed = await friend.locator("body").innerText();
    if (!/you(?:'|’)re in/i.test(landed)) throw new Error(`after signing up through the invite the friend landed on ${new URL(friend.url()).pathname} without a welcome`);
  } finally {
    await ctx.close();
  }

  // The inviter is credited, in the API and on their invite page.
  const after = await api(inviter, "GET", `${base}/api/invites`);
  if (after.invite?.stats?.joined !== 1) throw new Error(`inviter sees ${after.invite?.stats?.joined} friends joined, expected 1`);
  await expectText(inviter, `${base}/invite`, "1 friend you invited", "the inviter sees their friend joined");

  // Sharing a message is recorded and visible to the app's admins.
  await api(inviter, "POST", `${base}/api/invites`, { variantKey: "generic", method: "copy" });
  const { shares } = await api(page, "GET", `${base}/api/invites/shares`);
  if (!shares?.some((s) => s.variant_key === "generic" && Number(s.count) >= 1)) throw new Error("the admin does not see the recorded share");

  // A made-up code is refused honestly.
  await expectText(inviter, `${base}/invited-by/nope0000`, "isn", "an unknown invite code says it isn't active");
}
