import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { knownPlayerProfiles, knownProfileByUsername, knownProfileForEmail } from "../src/lib/known-profiles";

describe("known GizmoCraft profiles", () => {
  it("defines stable public profile usernames and Minecraft UUID attachments", () => {
    assert.deepEqual(knownPlayerProfiles.map((profile) => profile.username), ["gmrooster", "djolearmani", "gizmeta"]);
    assert.equal(knownProfileByUsername("GMRooster")?.minecraftUuid, "5e8db67a-1249-44dc-a053-713bd8a8844a");
    assert.equal(knownProfileByUsername("DjoleArmani")?.minecraftUuid, "1fa45424-66b3-4996-aeb7-089d78bc367c");
    assert.equal(knownProfileByUsername("Gizmeta")?.minecraftUuid, "947b65ff-be0f-4e25-8778-25e53f93e423");
  });

  it("stores only normalized email hashes for pre-attachment", () => {
    const hashes = knownPlayerProfiles.map((profile) => profile.emailSha256);
    assert.equal(new Set(hashes).size, knownPlayerProfiles.length);
    assert.ok(hashes.every((hash) => /^[a-f0-9]{64}$/.test(hash)));
    assert.equal(knownProfileForEmail("unknown@example.com"), null);
  });
});
