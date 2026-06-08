export type EditableProfileInput = {
  username?: unknown;
  name?: unknown;
  image?: unknown;
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned.length ? cleaned : undefined;
}

function cleanDataImage(value: string) {
  if (!/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(value)) return undefined;
  return value.length <= 100_000 ? value : undefined;
}

export function cleanProfileImageUrl(value: unknown) {
  const cleaned = cleanString(value, 100_000);
  if (!cleaned) return undefined;
  const dataImage = cleanDataImage(cleaned);
  if (dataImage) return dataImage;
  try {
    const url = new URL(cleaned);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function usernameFromEmail(email: string) {
  return normalizeUsername(email.split("@")[0] ?? "player") || "player";
}

export function profileUpdateFromInput(input: EditableProfileInput) {
  const usernameSource = cleanString(input.username, 64);
  const username = usernameSource ? normalizeUsername(usernameSource) : undefined;
  const name = cleanString(input.name, 80);
  const image = cleanProfileImageUrl(input.image);
  return {
    ...(username ? { username } : {}),
    ...(name ? { name } : {}),
    image: image ?? null,
  };
}
