import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getOrFallbackUserProfile, recordOrFallbackUserSignIn } from "@/lib/profile-store";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: googleClientId && googleClientSecret ? [GoogleProvider({ clientId: googleClientId, clientSecret: googleClientSecret })] : [],
  callbacks: {
    async signIn({ user, profile }) {
      if (!user.email) return false;
      await recordOrFallbackUserSignIn({
        email: user.email,
        name: user.name ?? profile?.name ?? null,
        image: user.image ?? null,
        emailVerified: null,
      });
      return true;
    },
    async jwt({ token, user }) {
      const email = user?.email;
      if (!email) return token;
      const profile = await getOrFallbackUserProfile({ email, name: user.name ?? token.name ?? null, image: user.image ?? token.picture ?? null });
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
