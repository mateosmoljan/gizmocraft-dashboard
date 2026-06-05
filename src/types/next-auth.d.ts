import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id?: string;
      username?: string;
      minecraftUuid?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string;
    minecraftUuid?: string | null;
  }
}
