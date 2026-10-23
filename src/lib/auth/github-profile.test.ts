import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { githubProfile } from "./github-profile.ts";
import { roleForEmail } from "./roles.ts";

const LINCOLN = "lincoln@unitedundergod.org";

const attacker = {
  id: 42,
  login: "attacker",
  name: "Attacker",
  email: LINCOLN,
  avatar_url: "https://example.test/a.png"
};

function emailsFetch(body: unknown, status = 200) {
  return async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), "https://api.github.com/user/emails");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), "Bearer token");
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
}

describe("GitHub verified email", () => {
  it("rejects an unverified email and never grants owner", async () => {
    let signedIn: { email: string } | undefined;

    await assert.rejects(
      async () => {
        signedIn = await githubProfile(
          attacker,
          { access_token: "token" },
          emailsFetch([{ email: LINCOLN, primary: true, verified: false }])
        );
      },
      /verified email/
    );

    assert.equal(signedIn, undefined);
    // The same address would be owner if sign-in had accepted it.
    assert.equal(roleForEmail(LINCOLN, {}), "owner");
    assert.notEqual(roleForEmail(signedIn?.email, {}), "owner");
  });

  it("does not grant owner when the unverified owner address sits beside a verified email", async () => {
    const user = await githubProfile(
      attacker,
      { access_token: "token" },
      emailsFetch([
        { email: LINCOLN, primary: true, verified: false },
        { email: "attacker@example.com", primary: false, verified: true }
      ])
    );

    assert.equal(user.email, "attacker@example.com");
    assert.notEqual(user.email, LINCOLN);
    assert.equal(roleForEmail(user.email, {}), "customer");
  });

  it("prefers a verified primary and still rejects when the emails request fails", async () => {
    const user = await githubProfile(
      { id: 7, login: "lincoln", name: "Lincoln", email: null, avatar_url: null },
      { access_token: "token" },
      emailsFetch([
        { email: "other@example.com", primary: false, verified: true },
        { email: " Lincoln@UnitedUnderGod.org ", primary: true, verified: true }
      ])
    );

    assert.equal(user.email, LINCOLN);
    assert.equal(roleForEmail(user.email, {}), "owner");

    await assert.rejects(
      () => githubProfile(attacker, { access_token: "token" }, emailsFetch({ message: "no" }, 403)),
      /verified email/
    );
  });
});
