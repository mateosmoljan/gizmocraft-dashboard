import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeEmail, normalizeUsername, profileUpdateFromInput } from "../src/lib/profile-model";

describe("profile model helpers", () => {
  it("normalizes email addresses for stable player linking", () => {
    assert.equal(normalizeEmail("  Player@Example.COM "), "player@example.com");
  });

  it("turns display names into safe scalable usernames", () => {
    assert.equal(normalizeUsername("Djole Armani!!"), "djole-armani");
    assert.equal(normalizeUsername("__GMRooster__"), "gmrooster");
  });

  it("keeps editable profile fields scoped and sanitized", () => {
    assert.deepEqual(
      profileUpdateFromInput({ username: " Cool Name ", name: " Mateo ", image: "https://example.com/a.png", ignored: "nope" }),
      { username: "cool-name", name: "Mateo", image: "https://example.com/a.png" },
    );
  });

  it("accepts compressed imported profile images as data URLs", () => {
    const image = "data:image/jpeg;base64," + Buffer.from("small avatar").toString("base64");
    assert.equal(profileUpdateFromInput({ image }).image, image);
  });
});
