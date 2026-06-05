import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getOrCreateUserProfile } from "@/lib/profile-store";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: googleClientId && googleClientSecret ? [GoogleProvider({ clientId: googleClientId, clientSecret: googleClientSecret })] : [],
  callbacks: {
    async signIn({ user, profile }) {
      if (!user.email) return false;
      await getOrCreateUserProfile({
        email: user.email,
        name: user.name ?? profile?.name ?? null,
        image: user.image ?? null,
        emailVerified: null,
      });
      return true;
    },
    async jwt({ token, user }) {
      const email = user?.email ?? token.email;
      if (!email) return token;
      const profile = await getOrCreateUserProfile({ email, name: token.name ?? user?.name ?? null, image: token.picture ?? user?.image ?? null });
      token.sub = profile.id;
      token.username = profile.username;
      token.minecraftUuid = profile.minecraftUuid;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email ?? session.user.email;
        session.user.name = token.name ?? session.user.name;
        session.user.image = token.picture ?? session.user.image;
        (session.user as any).id = token.sub;
        (session.user as any).username = token.username;
        (session.user as any).minecraftUuid = token.minecraftUuid;
      }
      return session;
    },
  },
};
