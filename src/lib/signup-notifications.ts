const DEFAULT_SIGNUP_NOTIFY_EMAIL = "sudodosu99@gmail.com";
const DEFAULT_SIGNUP_NOTIFY_FROM = "GizmoCraft <onboarding@resend.dev>";

type SignupNotificationInput = {
  email: string;
  name?: string | null;
  username?: string | null;
  minecraftUuid?: string | null;
};

export function signupNotificationRecipient() {
  return process.env.NEW_USER_NOTIFY_EMAIL || DEFAULT_SIGNUP_NOTIFY_EMAIL;
}

export function signupNotificationConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function notifyNewUserSignup(input: SignupNotificationInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = signupNotificationRecipient();
  if (!apiKey) {
    console.warn("New-user signup email not sent: RESEND_API_KEY is not configured.");
    return { sent: false, reason: "missing_resend_api_key" } as const;
  }

  const from = process.env.SIGNUP_NOTIFY_FROM || DEFAULT_SIGNUP_NOTIFY_FROM;
  const profileUrl = input.username ? `https://gizmocraft-dashboard.vercel.app/u/${input.username}` : "https://gizmocraft-dashboard.vercel.app/profiles";
  const subject = `New GizmoCraft signup: ${input.name || input.email}`;
  const text = [
    "A new user signed up for GizmoCraft.",
    "",
    `Name: ${input.name || "unknown"}`,
    `Email: ${input.email}`,
    `Username: ${input.username || "unknown"}`,
    `Minecraft UUID: ${input.minecraftUuid || "not linked"}`,
    `Profile: ${profileUrl}`,
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn("New-user signup email failed", response.status, body.slice(0, 500));
    return { sent: false, reason: `resend_${response.status}` } as const;
  }

  return { sent: true } as const;
}
