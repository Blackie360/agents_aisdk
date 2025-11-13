import NextAuth, { User, Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "./auth.config";

interface ExtendedSession extends Session {
  user: User;
}

// Simplified auth - no database, accepts any credentials
export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {},
      async authorize({ email }: any) {
        // No database - accept any email/password combination
        // Return a mock user
        return {
          id: email || "guest",
          email: email || "guest@example.com",
          name: email || "Guest",
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      return token;
    },
    async session({
      session,
      token,
    }: {
      session: ExtendedSession;
      token: any;
    }) {
      if (session.user) {
        session.user.id = token.id as string;
      }

      return session;
    },
  },
});
