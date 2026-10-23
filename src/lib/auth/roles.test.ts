import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPlatformOwnerEmail, roleForEmail } from "./roles.ts";

const LINCOLN = "lincoln@unitedundergod.org";

function assertLincolnIsOwner(env: Record<string, string | undefined>) {
  assert.equal(roleForEmail(LINCOLN, env), "owner");
  assert.equal(roleForEmail("  Lincoln@UnitedUnderGod.org  ", env), "owner");
  assert.equal(isPlatformOwnerEmail(LINCOLN, env), true);
  assert.equal(isPlatformOwnerEmail("Lincoln@UnitedUnderGod.org", env), true);
}

describe("permanent platform owner", () => {
  it("is owner when APP_ENGINE_OWNER_EMAIL is unset", () => {
    const env = {};
    assertLincolnIsOwner(env);
    assert.equal(roleForEmail("other@example.com", env), "customer");
    assert.equal(isPlatformOwnerEmail("other@example.com", env), false);
  });

  it("is owner when APP_ENGINE_OWNER_EMAIL is another address", () => {
    const env = { APP_ENGINE_OWNER_EMAIL: "other@example.com" };
    assertLincolnIsOwner(env);
    assert.equal(roleForEmail("other@example.com", env), "owner");
    assert.equal(roleForEmail("stranger@example.com", env), "customer");
    assert.equal(isPlatformOwnerEmail("stranger@example.com", env), false);
  });

  it("is owner when APP_ENGINE_OWNER_EMAIL is a comma list", () => {
    const env = { APP_ENGINE_OWNER_EMAIL: "one@example.com, two@example.com" };
    assertLincolnIsOwner(env);
    assert.equal(roleForEmail("one@example.com", env), "owner");
    assert.equal(roleForEmail("two@example.com", env), "owner");
    assert.equal(roleForEmail("stranger@example.com", env), "customer");
  });
});
