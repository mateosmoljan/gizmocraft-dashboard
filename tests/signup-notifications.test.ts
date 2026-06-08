import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { notifyNewUserSignup, signupNotificationRecipient } from "../src/lib/signup-notifications";

const originalResendKey = process.env.RESEND_API_KEY;
const originalNotifyEmail = process.env.NEW_USER_NOTIFY_EMAIL;

afterEach(() => {
  if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalResendKey;
  if (originalNotifyEmail === undefined) delete process.env.NEW_USER_NOTIFY_EMAIL;
  else process.env.NEW_USER_NOTIFY_EMAIL = originalNotifyEmail;
});

describe("signup notifications", () => {
  it("defaults new-user signup alerts to Mateo's email", () => {
    delete process.env.NEW_USER_NOTIFY_EMAIL;
    assert.equal(signupNotificationRecipient(), "sudodosu99@gmail.com");
  });

  it("does not block sign-in when the email provider is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await notifyNewUserSignup({ email: "new@example.com", name: "New User", username: "new-user" });
    assert.deepEqual(result, { sent: false, reason: "missing_resend_api_key" });
  });
});
